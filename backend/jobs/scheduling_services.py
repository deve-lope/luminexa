from datetime import date, datetime, timedelta, time

from django.db.models import Q
from django.utils import timezone

from businesses.models import Organization

from .models import AvailabilitySlot, ProviderNotification, Service, WeeklyScheduleBlock


def coerce_org_date(value, *, field_name: str = 'date') -> date | None:
    """Accept date, ISO date string, or None (API JSON often sends strings)."""
    if value is None or value == '':
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        return date.fromisoformat(value[:10])
    raise TypeError(f'Invalid {field_name}: expected YYYY-MM-DD')


def _combine(day: date, t: time, tz=None) -> datetime:
    tz = tz or timezone.get_current_timezone()
    return timezone.make_aware(datetime.combine(day, t), tz)


def sync_recurring_slots(organization, *, weeks_ahead: int = 3) -> int:
    """Create open availability slots from weekly schedule blocks. Returns count created."""
    if organization.scheduling_mode != Organization.SchedulingMode.RECURRING:
        return 0

    blocks = list(
        WeeklyScheduleBlock.objects.filter(organization=organization, is_active=True)
    )
    if not blocks:
        return 0

    services = list(Service.objects.filter(organization=organization, is_active=True))
    if not services:
        return 0

    org_tz = organization.get_timezone()
    today = timezone.localdate(timezone=org_tz)
    range_start = coerce_org_date(organization.schedule_valid_from) or today
    range_end = coerce_org_date(organization.schedule_valid_until) or (
        today + timedelta(weeks=weeks_ahead)
    )
    if range_end < range_start:
        return 0
    created = 0
    day = max(range_start, today)

    while day <= range_end:
        weekday = day.weekday()
        day_blocks = [b for b in blocks if b.weekday == weekday]
        for block in day_blocks:
            for service in services:
                duration = timedelta(minutes=service.duration_minutes)
                cursor = _combine(day, block.start_time, org_tz)
                block_end = _combine(day, block.end_time, org_tz)
                while cursor + duration <= block_end:
                    slot_end = cursor + duration
                    if cursor <= timezone.now():
                        cursor += duration
                        continue
                    exists = AvailabilitySlot.objects.filter(
                        organization=organization,
                        service=service,
                        start_at=cursor,
                    ).exists()
                    if not exists:
                        AvailabilitySlot.objects.create(
                            organization=organization,
                            service=service,
                            start_at=cursor,
                            end_at=slot_end,
                            status=AvailabilitySlot.Status.OPEN,
                        )
                        created += 1
                    cursor += duration
        day += timedelta(days=1)

    return created


def _next_week_start(from_date: date | None = None, *, tz=None) -> date:
    d = from_date or timezone.localdate(timezone=tz)
    days_ahead = (7 - d.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return d + timedelta(days=days_ahead)


def _clear_flexi_slot_notifications(organization, *, week_start=None):
    qs = ProviderNotification.objects.filter(
        organization=organization,
        kind=ProviderNotification.Kind.FLEXI_NO_SLOTS_NEXT_WEEK,
        dismissed_at__isnull=True,
    )
    if week_start is not None:
        qs = qs.filter(week_start=week_start)
    qs.delete()


def ensure_flexi_slot_alert(organization) -> ProviderNotification | None:
    """If flexi mode and no open slots next calendar week, create a provider notification."""
    if organization.scheduling_mode != Organization.SchedulingMode.FLEXI:
        # Stale flexi alerts can linger after switching to recurring mode.
        _clear_flexi_slot_notifications(organization)
        return None

    org_tz = organization.get_timezone()
    week_start = _next_week_start(tz=org_tz)
    week_end = week_start + timedelta(days=7)
    range_start = _combine(week_start, time.min, org_tz)
    range_end = _combine(week_end, time.min, org_tz)

    has_open = AvailabilitySlot.objects.filter(
        organization=organization,
        status=AvailabilitySlot.Status.OPEN,
        start_at__gte=range_start,
        start_at__lt=range_end,
        start_at__gt=timezone.now(),
    ).exists()

    if has_open:
        _clear_flexi_slot_notifications(organization)
        return None

    existing = ProviderNotification.objects.filter(
        organization=organization,
        kind=ProviderNotification.Kind.FLEXI_NO_SLOTS_NEXT_WEEK,
        week_start=week_start,
        dismissed_at__isnull=True,
    ).first()
    if existing:
        return existing

    label = week_start.strftime('%b %d')
    return ProviderNotification.objects.create(
        organization=organization,
        kind=ProviderNotification.Kind.FLEXI_NO_SLOTS_NEXT_WEEK,
        week_start=week_start,
        message=(
            f'No open slots for the week of {label}. '
            'Customers cannot book until you add availability on Schedule.'
        ),
    )


def get_active_notifications(organization):
    ensure_flexi_slot_alert(organization)
    return ProviderNotification.objects.filter(
        organization=organization,
        dismissed_at__isnull=True,
    ).order_by('-created_at')[:10]
