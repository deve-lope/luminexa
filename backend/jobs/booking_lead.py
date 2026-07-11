"""Rules for when customers may book / reschedule open slots."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError


def customer_booking_lead_hours() -> int:
    return int(getattr(settings, 'CUSTOMER_BOOKING_LEAD_HOURS', 2))


def earliest_customer_bookable_at(*, now=None):
    """Slots must start at or after this instant to be bookable by customers."""
    base = now if now is not None else timezone.now()
    return base + timedelta(hours=customer_booking_lead_hours())


def is_slot_start_bookable_for_customer(start_at, *, now=None) -> bool:
    if start_at is None:
        return False
    base = now if now is not None else timezone.now()
    if start_at <= base:
        return False
    return start_at >= earliest_customer_bookable_at(now=base)


def assert_slot_bookable_for_customer(slot, *, now=None):
    """Raise ValidationError if the slot is past or inside the lead-time buffer."""
    base = now if now is not None else timezone.now()
    hours = customer_booking_lead_hours()
    if slot.start_at <= base:
        raise ValidationError({'slot_id': 'This time slot is already over.'})
    earliest = earliest_customer_bookable_at(now=base)
    if slot.start_at < earliest:
        raise ValidationError({
            'slot_id': (
                f'Bookings must start at least {hours} hours from now. '
                'Please choose a later time.'
            ),
        })
