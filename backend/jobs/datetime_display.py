"""Human-readable booking datetimes for notifications, messages, and activity notes."""

import re

from django.utils import dateformat, timezone
from django.utils.dateparse import parse_datetime

# ISO-8601 as previously stored in BookingStatusEvent.note (e.g. isoformat()).
_ISO_IN_TEXT = re.compile(
    r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?'
    r'(?:Z|[+-]\d{2}:?\d{2})?'
)


def format_booking_when(dt):
    """Always include AM/PM (e.g. Aug 4, 2026, 2:30 PM)."""
    if not dt:
        return ''
    return dateformat.format(timezone.localtime(dt), 'M j, Y, g:i A')


def humanize_activity_note(note):
    """Replace raw ISO timestamps in activity notes with AM/PM display strings."""
    if not note:
        return note or ''

    def _replace(match):
        raw = match.group(0)
        parsed = parse_datetime(raw.replace('Z', '+00:00'))
        if not parsed:
            return raw
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.utc)
        return format_booking_when(parsed)

    return _ISO_IN_TEXT.sub(_replace, note)
