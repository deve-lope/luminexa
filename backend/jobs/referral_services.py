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
    max_earnings = _money(organization.referral_max_earnings_per_referrer)
    base = {
        'enabled': enabled,
        'reward_amount': str(_money(organization.referral_reward_amount)),
        'max_earnings_per_referrer': str(max_earnings),
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
            'at_cap': False,
        }
    code = get_or_create_referral_code(organization=organization, referrer=user)
    earned = earned_total(organization=organization, owner=user)
    room = remaining_cap(organization=organization, owner=user)
    return {
        **base,
        'code': code.code,
        'available_credit': str(available_credit(organization=organization, owner=user)),
        'earned_total': str(earned),
        'remaining_cap': str(room),
        'at_cap': room <= ZERO,
    }


def _org_book_key(org: Organization) -> str:
    return (getattr(org, 'public_ref', None) or org.slug or '').strip()


def referral_owner_stats_map(*, organization: Organization, owner_ids) -> dict[int, dict]:
    """
    Batch referral coupon stats for many customers at one org.
    Keys are user ids; values include earned/available/at_cap/rewarded_count.
    """
    from django.db.models import Count

    ids = [int(x) for x in owner_ids if x is not None]
    cap = _money(organization.referral_max_earnings_per_referrer)
    empty = {
        'earned_total': ZERO,
        'available_credit': ZERO,
        'rewarded_count': 0,
        'remaining_cap': cap,
        'at_cap': False,
        'max_earnings_per_referrer': cap,
    }
    out: dict[int, dict] = {uid: {**empty} for uid in ids}
    if not ids:
        return out

    earned_rows = (
        ReferralCoupon.objects.filter(organization=organization, owner_id__in=ids)
        .values('owner_id')
        .annotate(s=Sum('amount'), n=Count('id'))
    )
    for row in earned_rows:
        uid = row['owner_id']
        earned = _money(row['s'])
        room = max(ZERO, (cap - earned)) if cap > ZERO else ZERO
        out[uid]['earned_total'] = earned
        out[uid]['rewarded_count'] = int(row['n'] or 0)
        out[uid]['remaining_cap'] = room
        out[uid]['at_cap'] = room <= ZERO and earned > ZERO
        out[uid]['max_earnings_per_referrer'] = cap

    avail_rows = (
        ReferralCoupon.objects.filter(
            organization=organization,
            owner_id__in=ids,
            status=ReferralCoupon.Status.AVAILABLE,
            remaining__gt=0,
        )
        .values('owner_id')
        .annotate(s=Sum('remaining'))
    )
    for row in avail_rows:
        out[row['owner_id']]['available_credit'] = _money(row['s'])

    return out


def referred_by_map(*, organization: Organization, user_ids) -> dict[int, dict]:
    """Map referred_user_id → {referrer_id, referrer_name, status} for this org."""
    ids = [int(x) for x in user_ids if x is not None]
    if not ids:
        return {}
    rows = (
        Referral.objects.filter(organization=organization, referred_user_id__in=ids)
        .exclude(status=Referral.Status.INVALID)
        .select_related('referrer')
    )
    out = {}
    for ref in rows:
        name = (
            (ref.referrer.get_full_name() or '').strip()
            or (ref.referrer.email or '').split('@')[0]
            or 'Customer'
        )
        out[ref.referred_user_id] = {
            'referrer_id': ref.referrer_id,
            'referrer_name': name,
            'status': ref.status,
        }
    return out


def serialize_owner_referral_stats(stats: dict | None) -> dict:
    """Stringify decimal fields for API payloads."""
    s = stats or {}
    return {
        'referral_earned_total': str(_money(s.get('earned_total'))),
        'referral_available_credit': str(_money(s.get('available_credit'))),
        'referral_rewarded_count': int(s.get('rewarded_count') or 0),
        'referral_remaining_cap': str(_money(s.get('remaining_cap'))),
        'referral_at_cap': bool(s.get('at_cap')),
        'referral_max_earnings': str(_money(s.get('max_earnings_per_referrer'))),
    }

def customer_referrals_overview(*, user) -> dict:
    """Completed referrals + usable credit by provider for the logged-in customer."""
    referrals = (
        Referral.objects.filter(referrer=user)
        .exclude(status=Referral.Status.INVALID)
        .select_related('organization', 'referred_user', 'coupon')
        .order_by('-rewarded_at', '-created_at')
    )

    # Per-org earned / cap for labels on completed + credit rows.
    org_ids_seen: set[int] = set()
    for ref in referrals:
        org_ids_seen.add(ref.organization_id)
    for c in ReferralCoupon.objects.filter(owner=user).only('organization_id'):
        org_ids_seen.add(c.organization_id)

    org_stats: dict[int, dict] = {}
    for org in Organization.objects.filter(id__in=org_ids_seen):
        earned = earned_total(organization=org, owner=user)
        room = remaining_cap(organization=org, owner=user)
        cap = _money(org.referral_max_earnings_per_referrer)
        org_stats[org.id] = {
            'earned': earned,
            'remaining_cap': room,
            'max_earnings': cap,
            'at_cap': room <= ZERO and earned > ZERO,
            'available': available_credit(organization=org, owner=user),
        }

    completed = []
    pending = []
    for ref in referrals:
        org = ref.organization
        coupon = getattr(ref, 'coupon', None)
        stats = org_stats.get(org.id) or {}
        row = {
            'id': ref.id,
            'status': ref.status,
            'organization_name': org.name,
            'organization_slug': org.slug,
            'organization_public_ref': _org_book_key(org),
            'referred_name': (
                (ref.referred_user.get_full_name() or '').strip()
                or (ref.referred_user.email or '').split('@')[0]
                or 'Friend'
            ),
            'amount': str(_money(coupon.amount)) if coupon else '0.00',
            'remaining': str(_money(coupon.remaining)) if coupon else '0.00',
            'earned_total': str(stats.get('earned', ZERO)),
            'max_earnings_per_referrer': str(stats.get('max_earnings', ZERO)),
            'at_cap': bool(stats.get('at_cap')),
            'rewarded_at': ref.rewarded_at.isoformat() if ref.rewarded_at else None,
            'created_at': ref.created_at.isoformat() if ref.created_at else None,
        }
        if ref.status == Referral.Status.REWARDED:
            completed.append(row)
        elif ref.status == Referral.Status.PENDING:
            pending.append(row)
        elif ref.status == Referral.Status.CAPPED:
            # Cap hit — no new money; show max already received for this provider.
            completed.append({**row, 'amount': '0.00', 'remaining': '0.00'})

    credit_rows = []
    for org in Organization.objects.filter(id__in=org_ids_seen).order_by('name'):
        stats = org_stats[org.id]
        avail = stats['available']
        earned = stats['earned']
        if avail <= ZERO and earned <= ZERO:
            continue
        credit_rows.append({
            'organization_name': org.name,
            'organization_slug': org.slug,
            'organization_public_ref': _org_book_key(org),
            'available_credit': str(avail),
            'earned_total': str(earned),
            'max_earnings_per_referrer': str(stats['max_earnings']),
            'remaining_cap': str(stats['remaining_cap']),
            'at_cap': bool(stats['at_cap']),
        })

    return {
        'how_to_use': (
            'Referral credit is per business. Book again with that company — '
            'when they send your invoice, unused credit is applied automatically '
            'before tax. Credit cannot move to a different business. '
            'Each business sets a lifetime max; once you hit it, further referrals '
            'there do not earn more credit.'
        ),
        'credits': credit_rows,
        'completed': completed,
        'pending': pending,
    }
