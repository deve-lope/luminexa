"""Rate-service reminder eligibility (next calendar day, once, skip if app opened)."""

from __future__ import annotations

from datetime import datetime, time, timedelta

from django.utils import timezone

from .datetime_display import resolve_display_timezone


def booking_completed_at(booking):
    from .models import BookingStatusEvent

    ts = (
        BookingStatusEvent.objects.filter(
            booking=booking,
            action=BookingStatusEvent.Action.COMPLETED,
        )
        .order_by('-created_at')
        .values_list('created_at', flat=True)
        .first()
    )
    return ts or booking.updated_at


def next_local_day_start_after(dt, tz):
    """Midnight at the start of the calendar day after dt (in tz)."""
    local = timezone.localtime(dt, tz)
    next_day = local.date() + timedelta(days=1)
    return timezone.make_aware(datetime.combine(next_day, time.min), tz)


def customer_opened_app_on_or_after(customer, moment) -> bool:
    if not moment:
        return False
    for ts in (getattr(customer, 'app_last_seen_at', None), getattr(customer, 'last_login', None)):
        if ts and ts >= moment:
            return True
    return False


def should_send_rate_service_reminder(booking, *, now=None) -> bool:
    """
    True when we should send the one-time rate nudge:
    - completion was on a prior calendar day (org TZ)
    - customer has not opened the app since that next day began
    """
    now = now or timezone.now()
    completed_at = booking_completed_at(booking)
    tz = resolve_display_timezone(booking.organization)
    completed_local_date = timezone.localtime(completed_at, tz).date()
    now_local_date = timezone.localtime(now, tz).date()
    if now_local_date <= completed_local_date:
        return False
    next_day_start = next_local_day_start_after(completed_at, tz)
    if customer_opened_app_on_or_after(booking.customer, next_day_start):
        return False
    return True


def should_skip_rate_reminder_as_handled(booking, *, now=None) -> bool:
    """True when the customer opened the app after completion day — no push needed."""
    now = now or timezone.now()
    completed_at = booking_completed_at(booking)
    tz = resolve_display_timezone(booking.organization)
    if timezone.localtime(now, tz).date() <= timezone.localtime(completed_at, tz).date():
        return False
    next_day_start = next_local_day_start_after(completed_at, tz)
    return customer_opened_app_on_or_after(booking.customer, next_day_start)
