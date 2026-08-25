"""Human-readable booking datetimes for notifications, messages, and activity notes."""

import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import dateformat, timezone
from django.utils.dateparse import parse_datetime

# ISO-8601 as previously stored in BookingStatusEvent.note (e.g. isoformat()).
_ISO_IN_TEXT = re.compile(
    r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?'
    r'(?:Z|[+-]\d{2}:?\d{2})?'
)

# Match Organization.timezone default — never use Django TIME_ZONE (UTC) for user-facing copy.
_DEFAULT_DISPLAY_TZ = ZoneInfo('America/New_York')


def resolve_display_timezone(tz=None):
    """
    Resolve a display timezone from:
    - ZoneInfo / tzinfo
    - IANA name string
    - Organization (get_timezone)
    - Booking / object with .organization
    """
    if tz is None:
        return _DEFAULT_DISPLAY_TZ
    if hasattr(tz, 'get_timezone'):
        return tz.get_timezone()
    org = getattr(tz, 'organization', None)
    if org is not None and hasattr(org, 'get_timezone'):
        return org.get_timezone()
    if isinstance(tz, str):
        try:
            return ZoneInfo(tz)
        except (ZoneInfoNotFoundError, ValueError):
            return _DEFAULT_DISPLAY_TZ
    # Assume tzinfo-like
    return tz


def format_booking_when(dt, tz=None):
    """Always include AM/PM in the provider's timezone (e.g. Aug 4, 2026, 2:30 PM)."""
    if not dt:
        return ''
    local = timezone.localtime(dt, resolve_display_timezone(tz))
    return dateformat.format(local, 'M j, Y, g:i A')


def humanize_activity_note(note, tz=None):
    """Replace raw ISO timestamps in activity notes with AM/PM display strings."""
    if not note:
        return note or ''
    display_tz = resolve_display_timezone(tz)

    def _replace(match):
        raw = match.group(0)
        parsed = parse_datetime(raw.replace('Z', '+00:00'))
        if not parsed:
            return raw
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.utc)
        return format_booking_when(parsed, tz=display_tz)

    return _ISO_IN_TEXT.sub(_replace, note)
