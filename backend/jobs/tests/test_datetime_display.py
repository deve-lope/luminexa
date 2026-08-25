from datetime import datetime
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase

from jobs.datetime_display import format_booking_when, humanize_activity_note


class DatetimeDisplayTests(SimpleTestCase):
    def test_format_booking_when_includes_ampm(self):
        # 17:00 UTC = 1:00 PM Eastern (EDT, UTC-4 in August)
        dt = datetime(2026, 8, 4, 17, 0, tzinfo=ZoneInfo('UTC'))
        text = format_booking_when(dt, tz='America/New_York')
        self.assertEqual(text, 'Aug 4, 2026, 1:00 PM')
        self.assertNotIn('+00:00', text)

    def test_format_uses_org_timezone_not_django_utc(self):
        # Chat/browser show Eastern; emails must match (not UTC 3 PM).
        dt = datetime(2026, 8, 26, 15, 0, tzinfo=ZoneInfo('UTC'))
        text = format_booking_when(dt, tz='America/New_York')
        self.assertEqual(text, 'Aug 26, 2026, 11:00 AM')
        # Default (no tz) should still be Eastern product default, not UTC.
        self.assertEqual(format_booking_when(dt), 'Aug 26, 2026, 11:00 AM')

    def test_humanize_activity_note_rewrites_iso(self):
        note = 'New time: 2026-08-04T17:00:00+00:00'
        text = humanize_activity_note(note, tz='America/New_York')
        self.assertTrue(text.startswith('New time:'))
        self.assertEqual(text, 'New time: Aug 4, 2026, 1:00 PM')
        self.assertNotIn('+00:00', text)
        self.assertNotIn('T17:', text)
