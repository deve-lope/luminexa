from celery import shared_task
from django.utils import timezone

from businesses.models import Organization

from .notifications import send_booking_reminders_for_window
from .scheduling_services import sync_recurring_slots


@shared_task
def sync_org_recurring_slots(organization_id: int, weeks_ahead: int = 12) -> int:
    """Generate open slots for one org (used after schedule edits)."""
    org = Organization.objects.filter(pk=organization_id).first()
    if not org:
        return 0
    return sync_recurring_slots(org, weeks_ahead=weeks_ahead)


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
