from datetime import datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from businesses.models import Organization
from jobs.models import Booking, BookingStatusEvent, CustomerNotification, Service
from jobs.notifications import send_rate_service_reminders
from jobs.rate_reminder import should_send_rate_service_reminder


class RateReminderLogicTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email='customer@test.local',
            password='password123',
            full_name='Customer',
            phone='5550000002',
        )
        self.org = Organization.objects.create(
            name='Test Co',
            slug='test-co',
            timezone='America/Toronto',
            profile_public=True,
            is_active=True,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Oil change',
            duration_minutes=60,
            base_price='49.00',
            is_active=True,
        )

    def _completed_booking(self, completed_at):
        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=completed_at - timedelta(hours=1),
            end_at=completed_at,
            status=Booking.Status.COMPLETED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        event = BookingStatusEvent.objects.create(
            booking=booking,
            action=BookingStatusEvent.Action.COMPLETED,
            old_status=Booking.Status.CONFIRMED,
            new_status=Booking.Status.COMPLETED,
        )
        BookingStatusEvent.objects.filter(pk=event.pk).update(created_at=completed_at)
        Booking.objects.filter(pk=booking.pk).update(updated_at=completed_at)
        return booking

    def test_waits_until_day_after_completion(self):
        tz = ZoneInfo('America/Toronto')
        completed_at = timezone.make_aware(datetime(2026, 6, 1, 15, 0), tz)
        same_day = timezone.make_aware(datetime(2026, 6, 1, 22, 0), tz)
        booking = self._completed_booking(completed_at)
        self.assertFalse(should_send_rate_service_reminder(booking, now=same_day))

    @patch('jobs.notifications.notify_rate_service')
    def test_sends_once_on_next_day_if_app_not_opened(self, notify_mock):
        tz = ZoneInfo('America/Toronto')
        completed_at = timezone.make_aware(datetime(2026, 6, 1, 15, 0), tz)
        next_day = timezone.make_aware(datetime(2026, 6, 2, 10, 0), tz)
        booking = self._completed_booking(completed_at)

        with patch('jobs.notifications.timezone.now', return_value=next_day):
            sent = send_rate_service_reminders()

        self.assertEqual(sent, 1)
        notify_mock.assert_called_once_with(booking)
        booking.refresh_from_db()
        self.assertIsNotNone(booking.rate_reminder_sent_at)

        with patch('jobs.notifications.timezone.now', return_value=next_day):
            again = send_rate_service_reminders()
        self.assertEqual(again, 0)
        notify_mock.assert_called_once()

    @patch('jobs.notifications.notify_rate_service')
    def test_skips_if_customer_opened_app_next_day(self, notify_mock):
        tz = ZoneInfo('America/Toronto')
        completed_at = timezone.make_aware(datetime(2026, 6, 1, 15, 0), tz)
        next_day = timezone.make_aware(datetime(2026, 6, 2, 10, 0), tz)
        booking = self._completed_booking(completed_at)
        User.objects.filter(pk=self.customer.pk).update(
            app_last_seen_at=timezone.make_aware(datetime(2026, 6, 2, 8, 0), tz),
        )
        booking.customer.refresh_from_db()

        with patch('jobs.notifications.timezone.now', return_value=next_day):
            sent = send_rate_service_reminders()

        self.assertEqual(sent, 0)
        notify_mock.assert_not_called()
        booking.refresh_from_db()
        self.assertIsNotNone(booking.rate_reminder_sent_at)

    @patch('jobs.notifications.notify_rate_service')
    def test_sends_if_only_opened_on_completion_day(self, notify_mock):
        tz = ZoneInfo('America/Toronto')
        completed_at = timezone.make_aware(datetime(2026, 6, 1, 15, 0), tz)
        next_day = timezone.make_aware(datetime(2026, 6, 2, 10, 0), tz)
        booking = self._completed_booking(completed_at)
        User.objects.filter(pk=self.customer.pk).update(
            app_last_seen_at=timezone.make_aware(datetime(2026, 6, 1, 16, 0), tz),
        )
        booking.customer.refresh_from_db()

        with patch('jobs.notifications.timezone.now', return_value=next_day):
            sent = send_rate_service_reminders()

        self.assertEqual(sent, 1)
        notify_mock.assert_called_once()

    @patch('jobs.notifications.notify_rate_service')
    def test_creates_rate_notification(self, notify_mock):
        tz = ZoneInfo('America/Toronto')
        completed_at = timezone.make_aware(datetime(2026, 6, 1, 15, 0), tz)
        next_day = timezone.make_aware(datetime(2026, 6, 2, 10, 0), tz)
        booking = self._completed_booking(completed_at)
        notify_mock.side_effect = lambda b: CustomerNotification.objects.create(
            customer=b.customer,
            organization=b.organization,
            booking=b,
            kind=CustomerNotification.Kind.RATE_SERVICE,
            title='Rate your visit',
            message='Please rate',
            link_path=f'/customer/bookings/{b.pk}',
        )

        with patch('jobs.notifications.timezone.now', return_value=next_day):
            send_rate_service_reminders()

        self.assertTrue(
            CustomerNotification.objects.filter(
                booking=booking,
                kind=CustomerNotification.Kind.RATE_SERVICE,
            ).exists()
        )
