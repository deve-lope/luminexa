"""Provider-scheduled one-shot rebook reminders for completed jobs."""

from __future__ import annotations

from datetime import date, datetime

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Booking, BookingRebookReminder


def booking_supports_rebook_reminder(booking: Booking) -> bool:
    """Catalog services only — gig/custom jobs have no Book again deep link."""
    if not booking or not booking.service_id:
        return False
    if (getattr(booking, 'job_title', None) or '').strip():
        return False
    return True


def org_today(organization) -> date:
    return timezone.now().astimezone(organization.get_timezone()).date()


def parse_remind_on(value) -> date:
    if value in (None, ''):
        raise ValidationError({'rebook_remind_on': 'Choose a reminder date.'})
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value).strip()
    try:
        return date.fromisoformat(text[:10])
    except ValueError as exc:
        raise ValidationError({'rebook_remind_on': 'Use YYYY-MM-DD.'}) from exc


def validate_remind_on(organization, remind_on: date) -> date:
    today = org_today(organization)
    if remind_on <= today:
        raise ValidationError({'rebook_remind_on': 'Reminder date must be after today.'})
    return remind_on


@transaction.atomic
def upsert_rebook_reminder(
    booking: Booking,
    *,
    remind_on,
    note: str = '',
    staff_user=None,
) -> BookingRebookReminder:
    if booking.status != Booking.Status.COMPLETED:
        raise ValidationError({'detail': 'Rebook reminders can only be set on completed jobs.'})
    if not booking_supports_rebook_reminder(booking):
        raise ValidationError({'detail': 'Rebook reminders are only available for catalog services.'})

    remind_date = validate_remind_on(booking.organization, parse_remind_on(remind_on))
    note_text = (note or '').strip()[:200]

    existing = BookingRebookReminder.objects.filter(booking=booking).first()
    if existing:
        existing.organization = booking.organization
        existing.customer = booking.customer
        existing.service = booking.service
        existing.remind_on = remind_date
        existing.note = note_text
        existing.status = BookingRebookReminder.Status.PENDING
        existing.sent_at = None
        if staff_user is not None:
            existing.created_by = staff_user
        existing.save()
        return existing

    return BookingRebookReminder.objects.create(
        booking=booking,
        organization=booking.organization,
        customer=booking.customer,
        service=booking.service,
        remind_on=remind_date,
        note=note_text,
        status=BookingRebookReminder.Status.PENDING,
        created_by=staff_user,
    )


def cancel_rebook_reminder(booking: Booking) -> BookingRebookReminder | None:
    reminder = BookingRebookReminder.objects.filter(booking=booking).first()
    if reminder is None:
        return None
    if reminder.status == BookingRebookReminder.Status.PENDING:
        reminder.status = BookingRebookReminder.Status.CANCELLED
        reminder.save(update_fields=['status', 'updated_at'])
    return reminder


def customer_already_rebooked(reminder: BookingRebookReminder) -> bool:
    """True if the customer booked the same service again after the source job."""
    return Booking.objects.filter(
        organization_id=reminder.organization_id,
        customer_id=reminder.customer_id,
        service_id=reminder.service_id,
        created_at__gt=reminder.booking.created_at,
    ).exclude(
        status=Booking.Status.CANCELLED,
    ).exclude(
        pk=reminder.booking_id,
    ).exists()


def send_due_rebook_reminders(*, as_of: date | None = None) -> int:
    """Send pending reminders whose remind_on is today or earlier (per org timezone)."""
    from .notifications import notify_rebook_reminder, send_rebook_reminder_email

    now = timezone.now()
    pending = (
        BookingRebookReminder.objects.filter(status=BookingRebookReminder.Status.PENDING)
        .select_related('booking', 'organization', 'customer', 'service')
        .order_by('remind_on', 'id')
    )
    sent = 0
    for reminder in pending.iterator(chunk_size=100):
        org = reminder.organization
        local_today = as_of or now.astimezone(org.get_timezone()).date()
        if reminder.remind_on > local_today:
            continue
        if customer_already_rebooked(reminder):
            reminder.status = BookingRebookReminder.Status.SKIPPED
            reminder.save(update_fields=['status', 'updated_at'])
            continue
        try:
            notify_rebook_reminder(reminder)
            send_rebook_reminder_email(reminder)
        except Exception:
            import logging

            logging.getLogger(__name__).exception(
                'Failed to send rebook reminder %s', reminder.pk,
            )
            continue
        reminder.status = BookingRebookReminder.Status.SENT
        reminder.sent_at = now
        reminder.save(update_fields=['status', 'sent_at', 'updated_at'])
        sent += 1
    return sent


def apply_rebook_fields_from_request(booking: Booking, data, *, staff_user=None):
    """
    Optional complete-payload helper.
    - omit keys → no change
    - empty rebook_remind_on → cancel pending
    - date → upsert
    """
    if 'rebook_remind_on' not in data and 'rebook_note' not in data:
        return None
    raw_date = data.get('rebook_remind_on')
    if raw_date in (None, ''):
        return cancel_rebook_reminder(booking)
    note = data.get('rebook_note', '')
    try:
        return upsert_rebook_reminder(
            booking,
            remind_on=raw_date,
            note=note,
            staff_user=staff_user,
        )
    except DjangoValidationError as exc:
        raise ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else {'detail': str(exc)}) from exc
