"""Complimentary Pro access via redeemable promo codes."""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from businesses.models import Organization, PromoCode, PromoRedemption


def redeem_promo_code(*, org: Organization, user, code: str) -> Organization:
    """
    Redeem a promo code for complimentary Pro access.

    Shared codes allowed; one redemption per organization per code.
    Extends access if the org already has a later period end.
    """
    raw = (code or '').strip().upper()
    if not raw:
        raise ValidationError({'code': 'Enter a promo code.'})

    now = timezone.now()

    with transaction.atomic():
        promo = (
            PromoCode.objects.select_for_update()
            .filter(code=raw)
            .first()
        )
        if not promo or not promo.is_active:
            raise ValidationError({'code': 'Invalid promo code.', 'code_error': 'invalid'})

        if promo.valid_from and now < promo.valid_from:
            raise ValidationError({'code': 'This promo code is not active yet.', 'code_error': 'not_started'})

        if promo.valid_until and now > promo.valid_until:
            raise ValidationError({'code': 'This promo code has expired.', 'code_error': 'expired'})

        if PromoRedemption.objects.filter(promo_code=promo, organization=org).exists():
            raise ValidationError({
                'code': 'This business has already redeemed this promo code.',
                'code_error': 'already_redeemed',
            })

        if promo.max_redemptions is not None:
            used = PromoRedemption.objects.filter(promo_code=promo).count()
            if used >= promo.max_redemptions:
                raise ValidationError({
                    'code': 'This promo code has reached its redemption limit.',
                    'code_error': 'max_redemptions',
                })

        grant_until = now + timedelta(weeks=int(promo.grant_weeks))
        existing_end = org.subscription_current_period_end
        if existing_end and existing_end > grant_until:
            grant_until = existing_end

        PromoRedemption.objects.create(
            promo_code=promo,
            organization=org,
            redeemed_by=user,
            granted_until=grant_until,
        )

        stripe_active = (
            (org.subscription_source or '') == 'stripe'
            and (org.subscription_status or '') in ('active', 'trialing')
        )
        if stripe_active:
            # Paid Stripe keeps ownership of status; only extend access window if needed.
            if not existing_end or grant_until > existing_end:
                org.subscription_current_period_end = grant_until
                org.save(update_fields=['subscription_current_period_end', 'updated_at'])
        else:
            org.subscription_status = 'trialing'
            org.subscription_plan = 'pro_monthly'
            org.subscription_source = 'promo'
            org.subscription_current_period_end = grant_until
            org.save(update_fields=[
                'subscription_status',
                'subscription_plan',
                'subscription_source',
                'subscription_current_period_end',
                'updated_at',
            ])

    return org


def send_promo_offer_notifications(
    *,
    organizations,
    promo: PromoCode,
    custom_message: str = '',
) -> int:
    """
    Create in-app promo_offer notifications for each organization.

    Returns the number of notifications created. Skips orgs that already
    redeemed this code. Message includes the code; link opens Billing with ?promo=.
    """
    from jobs.models import ProviderNotification

    orgs = list(organizations)
    if not orgs or not promo or not promo.is_active:
        return 0

    already = set(
        PromoRedemption.objects.filter(
            promo_code=promo,
            organization_id__in=[o.pk for o in orgs],
        ).values_list('organization_id', flat=True)
    )

    weeks = int(promo.grant_weeks)
    week_label = '1 week' if weeks == 1 else f'{weeks} weeks'
    custom = (custom_message or '').strip()
    if custom:
        base_msg = custom
        if promo.code not in base_msg:
            base_msg = f'{base_msg} Use code {promo.code} for {week_label} of Pro.'
    else:
        base_msg = (
            f'Complimentary Pro offer: use code {promo.code} for {week_label}. '
            f'Open Billing to redeem.'
        )
    message = base_msg[:500]

    created = 0
    for org in orgs:
        if org.pk in already:
            continue
        link = f'/provider/{org.slug}/billing?promo={promo.code}'
        ProviderNotification.objects.create(
            organization=org,
            kind=ProviderNotification.Kind.PROMO_OFFER,
            message=message,
            link_path=link,
        )
        created += 1
    return created
