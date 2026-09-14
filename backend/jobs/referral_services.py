"""Provider referral rewards: share codes, qualify on completed work, coupon credit."""

from __future__ import annotations

import secrets
import string
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from businesses.models import Organization

from .models import Booking, Invoice, Referral, ReferralCode, ReferralCoupon

ZERO = Decimal('0.00')


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal('0.01'))


def program_is_active(org: Organization) -> bool:
    if not org or not org.referral_rewards_enabled:
        return False
    return (
        _money(org.referral_reward_amount) > ZERO
        and _money(org.referral_max_earnings_per_referrer) > ZERO
    )


def _generate_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(20):
        code = 'R' + ''.join(secrets.choice(alphabet) for _ in range(7))
        if not ReferralCode.objects.filter(code=code).exists():
            return code
    return 'R' + secrets.token_hex(4).upper()


def get_or_create_referral_code(*, organization: Organization, referrer) -> ReferralCode:
    existing = ReferralCode.objects.filter(
        organization=organization, referrer=referrer,
    ).first()
    if existing:
        return existing
    return ReferralCode.objects.create(
        organization=organization,
        referrer=referrer,
        code=_generate_code(),
    )


def earned_total(*, organization: Organization, owner) -> Decimal:
    total = ReferralCoupon.objects.filter(
        organization=organization,
        owner=owner,
    ).aggregate(s=Sum('amount'))['s']
    return _money(total)


def available_credit(*, organization: Organization, owner) -> Decimal:
    total = ReferralCoupon.objects.filter(
        organization=organization,
        owner=owner,
        status=ReferralCoupon.Status.AVAILABLE,
        remaining__gt=0,
    ).aggregate(s=Sum('remaining'))['s']
    return _money(total)


def remaining_cap(*, organization: Organization, owner) -> Decimal:
    cap = _money(organization.referral_max_earnings_per_referrer)
    if cap <= ZERO:
        return ZERO
    return max(ZERO, (cap - earned_total(organization=organization, owner=owner)))


@transaction.atomic
def attach_referral_attribution(*, booking: Booking, code: str) -> Referral | None:
    """
    Record that this booking's customer arrived via a referral code.
    Credit is granted only when the referred customer's job is completed.
    """
    raw = (code or '').strip().upper()
    if not raw:
        return None

    org = booking.organization
    if not program_is_active(org):
        return None

    referred = booking.customer
    ref_code = (
        ReferralCode.objects.select_related('referrer')
        .filter(code=raw, organization=org)
        .first()
    )
    if not ref_code:
        return None
    if ref_code.referrer_id == referred.id:
        return None

    existing = Referral.objects.filter(
        organization=org, referred_user=referred,
    ).first()
    if existing:
        return existing

    return Referral.objects.create(
        organization=org,
        referrer=ref_code.referrer,
        referred_user=referred,
        referral_code=ref_code,
        status=Referral.Status.PENDING,
    )


@transaction.atomic
def qualify_referral_on_completion(*, booking: Booking) -> ReferralCoupon | None:
    """Issue coupon credit to the referrer after the referred customer completes a job."""
    if booking.status != Booking.Status.COMPLETED:
        return None

    org = booking.organization
    referral = (
        Referral.objects.select_for_update()
        .filter(
            organization=org,
            referred_user_id=booking.customer_id,
            status=Referral.Status.PENDING,
        )
        .first()
    )
    if not referral:
        return None

    # Self-referral guard only — pending attributions still qualify even if the
    # program was turned off afterward (earned credit must still be grantable).
    if referral.referrer_id == booking.customer_id:
        referral.status = Referral.Status.INVALID
        referral.save(update_fields=['status'])
        return None

    reward = _money(org.referral_reward_amount)
    if reward <= ZERO:
        referral.status = Referral.Status.INVALID
        referral.save(update_fields=['status'])
        return None

    room = remaining_cap(organization=org, owner=referral.referrer)
    referral.qualifying_booking = booking
    referral.rewarded_at = timezone.now()

    if room <= ZERO:
        referral.status = Referral.Status.CAPPED
        referral.save(update_fields=['status', 'qualifying_booking', 'rewarded_at'])
        return None

    grant = min(reward, room)
    coupon = ReferralCoupon.objects.create(
        organization=org,
        owner=referral.referrer,
        referral=referral,
        amount=grant,
        remaining=grant,
        status=ReferralCoupon.Status.AVAILABLE,
    )
    referral.status = Referral.Status.REWARDED
    referral.save(update_fields=['status', 'qualifying_booking', 'rewarded_at'])
    return coupon


@transaction.atomic
def consume_referral_credit(*, booking: Booking, pre_tax: Decimal) -> Decimal:
    """
    Draw down the customer's available referral coupons for this org.
    Returns discount amount (≤ pre_tax). Caller should link coupons to the invoice.
    """
    pre_tax = _money(pre_tax)
    if pre_tax <= ZERO:
        return ZERO

    org = booking.organization
    customer = booking.customer
    budget = pre_tax
    discount = ZERO
    now = timezone.now()
    touched_ids: list[int] = []

    coupons = list(
        ReferralCoupon.objects.select_for_update()
        .filter(
            organization=org,
            owner=customer,
            status=ReferralCoupon.Status.AVAILABLE,
            remaining__gt=0,
        )
        .order_by('created_at', 'id')
    )

    for coupon in coupons:
        if budget <= ZERO:
            break
        take = min(_money(coupon.remaining), budget)
        if take <= ZERO:
            continue
        coupon.remaining = _money(coupon.remaining) - take
        update_fields = ['remaining']
        if coupon.remaining <= ZERO:
            coupon.remaining = ZERO
            coupon.status = ReferralCoupon.Status.APPLIED
            coupon.applied_at = now
            update_fields.extend(['status', 'applied_at'])
        coupon.save(update_fields=update_fields)
        touched_ids.append(coupon.id)
        discount += take
        budget -= take

    # Stash ids on booking for link step within same request (thread-local via attr).
    booking._referral_coupon_ids_touched = touched_ids  # noqa: SLF001
    return _money(discount)


def link_consumed_coupons_to_invoice(*, booking: Booking, invoice: Invoice) -> None:
    ids = getattr(booking, '_referral_coupon_ids_touched', None) or []
    if not ids:
        return
    ReferralCoupon.objects.filter(id__in=ids).update(last_applied_invoice=invoice)


def referral_summary_for_user(*, organization: Organization, user) -> dict:
    """Payload for customer/provider referral status endpoints."""
    enabled = program_is_active(organization)
    base = {
        'enabled': enabled,
        'reward_amount': str(_money(organization.referral_reward_amount)),
        'max_earnings_per_referrer': str(
            _money(organization.referral_max_earnings_per_referrer)
        ),
    }
    if not user or not getattr(user, 'is_authenticated', False):
        return base
    if not user.is_authenticated:
        return base
    if not enabled:
        return {
            **base,
            'code': None,
            'available_credit': '0.00',
            'earned_total': '0.00',
            'remaining_cap': '0.00',
        }
    code = get_or_create_referral_code(organization=organization, referrer=user)
    return {
        **base,
        'code': code.code,
        'available_credit': str(available_credit(organization=organization, owner=user)),
        'earned_total': str(earned_total(organization=organization, owner=user)),
        'remaining_cap': str(remaining_cap(organization=organization, owner=user)),
    }
