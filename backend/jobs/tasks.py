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


@shared_task
def send_incomplete_job_task_reminders():
    """Remind providers ~48h before jobs that still have incomplete tasks."""
    from .notifications import send_incomplete_job_task_reminders_for_window

    return send_incomplete_job_task_reminders_for_window()


@shared_task
def send_unpaid_invoice_payment_reminders():
    """Send email follow-ups for unpaid issued invoices."""
    from .notifications import send_unpaid_invoice_followups

    return send_unpaid_invoice_followups()


@shared_task
def send_rate_service_reminders():
    """Ask customers to rate completed jobs (delayed, awake hours only)."""
    from .notifications import send_rate_service_reminders as _send

    return _send()


@shared_task
def send_subscription_ending_reminders():
    """Remind providers 30 / 7 / 2 days before trial or promo Pro access ends."""
    from .subscription_reminder_services import send_subscription_ending_reminders as _send

    return _send()


@shared_task
def purge_stale_quotes():
    """Delete quote requests and unconfirmed quote bookings older than one year."""
    from .quote_cleanup_services import purge_stale_quotes as _purge

    return _purge()
