from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from businesses.models import Organization
from jobs.models import Booking, CustomerNotification, Service
from jobs.notifications import send_booking_reminders_for_window


class CustomerReminderNotificationTests(TestCase):
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

    @patch('jobs.notifications.send_booking_email')
    @patch('jobs.push_services.send_push_to_user')
    def test_day_before_reminder_creates_in_app_and_push(self, push_mock, email_mock):
        now = timezone.now()
        start_at = now + timedelta(hours=24, minutes=15)
        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )

        sent = send_booking_reminders_for_window(hours_ahead=24, window_hours=1)

        self.assertEqual(sent, 1)
        email_mock.assert_called_once_with('booking_reminder', booking)
        push_mock.assert_called_once()
        note = CustomerNotification.objects.get(
            booking=booking,
            kind=CustomerNotification.Kind.BOOKING_REMINDER,
        )
        self.assertIn('tomorrow', note.message.lower())
        self.assertIn('Oil change', note.message)
        booking.refresh_from_db()
        self.assertIsNotNone(booking.reminder_sent_at)
