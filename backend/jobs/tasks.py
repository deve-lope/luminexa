from celery import shared_task
from django.utils import timezone

from businesses.models import Organization

from .notifications import send_booking_reminders_for_window
from .scheduling_services import sync_recurring_slots


@shared_task
def sync_all_recurring_slots():
    """Nightly: generate open slots for orgs on recurring scheduling."""
    total = 0
    for org in Organization.objects.filter(
        is_active=True,
        scheduling_mode=Organization.SchedulingMode.RECURRING,
    ):
        total += sync_recurring_slots(org)
    return total


@shared_task
def send_upcoming_booking_reminders():
    """Send 24h-before reminder emails for confirmed bookings."""
    return send_booking_reminders_for_window()
