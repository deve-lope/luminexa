from .models import Booking, BookingStatusEvent


def log_booking_event(
    booking,
    *,
    action,
    actor=None,
    old_status='',
    new_status='',
    note='',
):
    BookingStatusEvent.objects.create(
        booking=booking,
        actor=actor,
        action=action,
        old_status=old_status or '',
        new_status=new_status or booking.status,
        note=note or '',
    )


def log_booking_status_change(booking, *, actor, action, old_status, new_status='', note=''):
    log_booking_event(
        booking,
        action=action,
        actor=actor,
        old_status=old_status,
        new_status=new_status or booking.status,
        note=note,
    )
