"""Side effects and validation when providers mark time unavailable."""

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .booking_services import decline_booking_request
from .models import AvailabilitySlot, Booking, UnavailableBlock

# Bookings that must not be covered by a new unavailable block.
BLOCKING_BOOKING_STATUSES = frozenset({
    Booking.Status.CONFIRMED,
    Booking.Status.IN_PROGRESS,
    Booking.Status.COMPLETED,
})


def find_confirmed_booking_overlap(organization, start_at, end_at):
    """Return first confirmed (or in-progress/completed) booking overlapping the window."""
    return (
        Booking.objects.filter(
            organization=organization,
            status__in=BLOCKING_BOOKING_STATUSES,
            start_at__lt=end_at,
            end_at__gt=start_at,
        )
        .select_related('service', 'customer')
        .order_by('start_at')
        .first()
    )


def validate_unavailable_window(organization, start_at, end_at, *, exclude_block_id=None):
    """Raise ValidationError if the window covers a confirmed booking."""
    if start_at >= end_at:
        raise ValidationError({'end_at': 'End must be after start.'})

    booking = find_confirmed_booking_overlap(organization, start_at, end_at)
    if booking:
        label = booking.service.name
        when = booking.start_at.strftime('%b %d, %I:%M %p')
        raise ValidationError(
            f'This time overlaps a confirmed booking ({label}, {when}). '
            'Choose a different range or reschedule the job first.'
        )

    if exclude_block_id is not None:
        block_overlap = UnavailableBlock.objects.filter(
            organization=organization,
            start_at__lt=end_at,
            end_at__gt=start_at,
        ).exclude(pk=exclude_block_id)
    else:
        block_overlap = UnavailableBlock.objects.filter(
            organization=organization,
            start_at__lt=end_at,
            end_at__gt=start_at,
        )
    if block_overlap.exists():
        raise ValidationError('This time overlaps another unavailable block.')


@transaction.atomic
def apply_unavailable_side_effects(organization, start_at, end_at) -> dict:
    """
    Remove overlapping open slots and decline pending requests in the window.
    Confirmed bookings must be rejected before this runs (see validate_unavailable_window).
    """
    pending_bookings = list(
        Booking.objects.filter(
            organization=organization,
            status=Booking.Status.REQUESTED,
            start_at__lt=end_at,
            end_at__gt=start_at,
        ).select_related('availability_slot')
    )
    pending_declined = 0
    for booking in pending_bookings:
        decline_booking_request(booking)
        pending_declined += 1

    open_qs = AvailabilitySlot.objects.filter(
        organization=organization,
        status=AvailabilitySlot.Status.OPEN,
        start_at__lt=end_at,
        end_at__gt=start_at,
    )
    open_removed, _ = open_qs.delete()

    return {
        'open_slots_removed': open_removed,
        'pending_requests_declined': pending_declined,
    }
