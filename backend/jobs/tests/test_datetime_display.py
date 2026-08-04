from datetime import datetime
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase

from jobs.datetime_display import format_booking_when, humanize_activity_note


class DatetimeDisplayTests(SimpleTestCase):
    def test_format_booking_when_includes_ampm(self):
        dt = datetime(2026, 8, 4, 17, 0, tzinfo=ZoneInfo('UTC'))
        text = format_booking_when(dt)
        self.assertIn('PM', text)
        self.assertNotIn('+00:00', text)
        self.assertNotRegex(text, r'\b1[3-9]:|\b2[0-4]:')

    def test_humanize_activity_note_rewrites_iso(self):
        note = 'New time: 2026-08-04T17:00:00+00:00'
        text = humanize_activity_note(note)
        self.assertTrue(text.startswith('New time:'))
        self.assertIn('PM', text)
        self.assertNotIn('+00:00', text)
        self.assertNotIn('T17:', text)
