from datetime import timedelta

from django.utils import timezone

from .booking_services import _lock_slot, release_slot
from .models import Booking, CustomerServiceInquiry

QUOTE_RETENTION_DAYS = 365

_REMOVABLE_INQUIRY_STATUSES = (
    CustomerServiceInquiry.Status.PENDING,
    CustomerServiceInquiry.Status.ACTIVE,
    CustomerServiceInquiry.Status.QUOTED,
    CustomerServiceInquiry.Status.QUOTE_ACCEPTED,
    CustomerServiceInquiry.Status.CANCELLED,
    CustomerServiceInquiry.Status.DECLINED,
)


def purge_stale_quotes(*, older_than_days=QUOTE_RETENTION_DAYS):
    """
    Delete quote requests and unconfirmed quote bookings older than the retention window.
    Completed inquiries (booked) are kept for history.
    """
    cutoff = timezone.now() - timedelta(days=older_than_days)

    inquiry_deleted, _ = CustomerServiceInquiry.objects.filter(
        created_at__lt=cutoff,
        status__in=_REMOVABLE_INQUIRY_STATUSES,
    ).delete()

    stale_bookings = Booking.objects.filter(
        created_at__lt=cutoff,
        status__in=(Booking.Status.REQUESTED, Booking.Status.QUOTED),
    ).select_related('availability_slot')

    bookings_deleted = 0
    for booking in stale_bookings.iterator(chunk_size=200):
        if booking.availability_slot_id:
            release_slot(_lock_slot(booking.availability_slot))
        booking.delete()
        bookings_deleted += 1

    return {
        'inquiries_deleted': inquiry_deleted,
        'bookings_deleted': bookings_deleted,
    }
