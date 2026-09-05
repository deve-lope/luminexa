"""Remind providers before complimentary / trial Pro access ends."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from django.utils.dateformat import format as dateformat

from businesses.models import Organization

# (days_before, org field storing period_end this tier was sent for, human label)
SUBSCRIPTION_ENDING_REMINDER_TIERS = (
    (30, 'subscription_ending_reminder_30d_for', '1 month'),
    (7, 'subscription_ending_reminder_7d_for', '7 days'),
    (2, 'subscription_ending_reminder_2d_for', '2 days'),
)


def org_needs_subscription_ending_reminders(org: Organization) -> bool:
    """
    True when Pro access ends at subscription_current_period_end.

    Promo grants and Stripe trials expire at period end. Paid Stripe active
    subscriptions auto-renew, so those are skipped.
    """
    status = (getattr(org, 'subscription_status', None) or 'none').lower()
    if status not in ('active', 'trialing'):
        return False
    if not getattr(org, 'subscription_current_period_end', None):
        return False
    source = (getattr(org, 'subscription_source', None) or 'none').lower()
    if source == 'promo':
        return True
    if status == 'trialing':
        return True
    return False


def _period_end_label(period_end) -> str:
    local = timezone.localtime(period_end)
    return dateformat(local, 'N j, Y')


def notify_provider_subscription_ending(org, *, days_before: int, label: str):
    """In-app + push + email when Pro access is about to end."""
    from jobs.models import ProviderNotification
    from jobs.notifications import _provider_staff_emails, _push_org_staff, _public_app_url, _send_to

    period_end = org.subscription_current_period_end
    end_label = _period_end_label(period_end)
    link_path = f'/provider/{org.slug}/billing'
    billing_url = f'{_public_app_url()}{link_path}'

    message = (
        f'Your Luminexa Pro access for {org.name} ends in {label} '
        f'(on {end_label}). Renew on Billing to keep taking bookings.'
    )
    ProviderNotification.objects.create(
        organization=org,
        kind=ProviderNotification.Kind.SUBSCRIPTION_ENDING,
        message=message[:500],
        link_path=link_path,
    )
    _push_org_staff(
        org,
        title=f'Pro ends in {label}',
        body=f'{org.name} — access ends {end_label}. Open Billing to renew.',
        link_path=link_path,
    )

    recipients = _provider_staff_emails(org)
    if recipients:
        subject = f'Luminexa Pro ends in {label} — {org.name}'
        body_lines = [
            'Hi,',
            '',
            f'Your Luminexa Pro subscription for {org.name} ends in {label}.',
            f'Access ends on {end_label}.',
            '',
            'Renew now so you can keep managing bookings, jobs, and your public page.',
            '',
            f'Renew / manage billing: {billing_url}',
            '',
            '— Luminexa',
        ]
        _send_to(recipients, subject, body_lines)


def send_subscription_ending_reminders(*, window_hours: int = 24) -> int:
    """
    Send 30-day, 7-day, and 2-day ending reminders for trial/promo Pro access.

    Uses a rolling window so an hourly beat still fires once per tier per period_end.
    Returns the number of reminder notifications sent.
    """
    now = timezone.now()
    window = timedelta(hours=window_hours)
    sent = 0

    base_qs = Organization.objects.filter(
        is_active=True,
        subscription_status__in=('active', 'trialing'),
        subscription_current_period_end__isnull=False,
        subscription_current_period_end__gt=now,
    ).filter(
        Q(subscription_source='promo') | Q(subscription_status='trialing')
    )

    for days_before, field_name, label in SUBSCRIPTION_ENDING_REMINDER_TIERS:
        # ~N days before end: [now+N − 1h, now+N + window) so exact boundaries are not missed.
        window_start = now + timedelta(days=days_before) - timedelta(hours=1)
        window_end = now + timedelta(days=days_before) + window
        candidates = base_qs.filter(
            subscription_current_period_end__gte=window_start,
            subscription_current_period_end__lt=window_end,
        )
        for org in candidates:
            if not org_needs_subscription_ending_reminders(org):
                continue
            if getattr(org, field_name) == org.subscription_current_period_end:
                continue
            notify_provider_subscription_ending(
                org, days_before=days_before, label=label,
            )
            setattr(org, field_name, org.subscription_current_period_end)
            org.save(update_fields=[field_name, 'updated_at'])
            sent += 1

    return sent
