from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import Booking, BookingRebookReminder, CustomerNotification, Service
from jobs.rebook_reminder_services import (
    cancel_rebook_reminder,
    send_due_rebook_reminders,
    upsert_rebook_reminder,
)


class RebookReminderTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email='customer@test.local',
            password='password123',
            full_name='Customer',
            phone='5550000002',
        )
        self.owner = User.objects.create_user(
            email='owner@test.local',
            password='password123',
            full_name='Owner',
            phone='5550000001',
        )
        self.org = Organization.objects.create(
            name='Test Co',
            slug='test-co',
            public_ref='pro99',
            timezone='America/Toronto',
            profile_public=True,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Tire change',
            duration_minutes=60,
            base_price='89.00',
            is_active=True,
        )
        now = timezone.now()
        self.booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=now - timedelta(days=1),
            end_at=now - timedelta(days=1) + timedelta(hours=1),
            status=Booking.Status.COMPLETED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def _future_date(self, days=30):
        return (timezone.now().astimezone(self.org.get_timezone()).date() + timedelta(days=days))

    def test_upsert_creates_pending_reminder(self):
        remind_on = self._future_date(90)
        reminder = upsert_rebook_reminder(
            self.booking,
            remind_on=remind_on.isoformat(),
            note='Next summer tires',
            staff_user=self.owner,
        )
        self.assertEqual(reminder.status, BookingRebookReminder.Status.PENDING)
        self.assertEqual(reminder.remind_on, remind_on)
        self.assertEqual(reminder.note, 'Next summer tires')
        self.assertEqual(reminder.service_id, self.service.id)

    def test_past_date_rejected(self):
        today = timezone.now().astimezone(self.org.get_timezone()).date()
        with self.assertRaises(Exception):
            upsert_rebook_reminder(self.booking, remind_on=today.isoformat())

    def test_complete_with_rebook_fields(self):
        remind_on = self._future_date(60)
        # Put booking back so complete can run
        self.booking.status = Booking.Status.IN_PROGRESS
        self.booking.save(update_fields=['status'])
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/complete/',
            {
                'service_fee': '89.00',
                'rebook_remind_on': remind_on.isoformat(),
                'rebook_note': 'Winter tires April 1',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIsNotNone(res.data.get('rebook_reminder'))
        self.assertEqual(res.data['rebook_reminder']['remind_on'], remind_on.isoformat())
        self.assertEqual(res.data['rebook_reminder']['note'], 'Winter tires April 1')
        self.assertEqual(res.data['rebook_reminder']['status'], 'pending')

    def test_delete_cancels_pending(self):
        upsert_rebook_reminder(self.booking, remind_on=self._future_date(10))
        res = self.client.delete(f'/api/v1/bookings/{self.booking.id}/rebook-reminder/')
        self.assertEqual(res.status_code, 200, res.content)
        reminder = BookingRebookReminder.objects.get(booking=self.booking)
        self.assertEqual(reminder.status, BookingRebookReminder.Status.CANCELLED)

    @patch('jobs.notifications.send_rebook_reminder_email')
    @patch('jobs.push_services.send_push_to_user')
    def test_due_sweep_sends(self, push_mock, email_mock):
        remind_on = timezone.now().astimezone(self.org.get_timezone()).date()
        reminder = BookingRebookReminder.objects.create(
            booking=self.booking,
            organization=self.org,
            customer=self.customer,
            service=self.service,
            remind_on=remind_on,
            note='Season check',
            status=BookingRebookReminder.Status.PENDING,
        )

        sent = send_due_rebook_reminders(as_of=remind_on)
        self.assertEqual(sent, 1)
        email_mock.assert_called_once()
        push_mock.assert_called_once()
        reminder.refresh_from_db()
        self.assertEqual(reminder.status, BookingRebookReminder.Status.SENT)
        self.assertIsNotNone(reminder.sent_at)
        note = CustomerNotification.objects.get(
            booking=self.booking,
            kind=CustomerNotification.Kind.REBOOK_REMINDER,
        )
        self.assertIn('Tire change', note.message)
        self.assertEqual(note.link_path, f'/customer/provider/pro99/{self.service.id}')

    def test_skip_when_already_rebooked(self):
        remind_on = timezone.now().astimezone(self.org.get_timezone()).date()
        BookingRebookReminder.objects.create(
            booking=self.booking,
            organization=self.org,
            customer=self.customer,
            service=self.service,
            remind_on=remind_on,
            status=BookingRebookReminder.Status.PENDING,
        )
        later = timezone.now() + timedelta(hours=1)
        Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=later,
            end_at=later + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        sent = send_due_rebook_reminders(as_of=remind_on)
        self.assertEqual(sent, 0)
        reminder = BookingRebookReminder.objects.get(booking=self.booking)
        self.assertEqual(reminder.status, BookingRebookReminder.Status.SKIPPED)

    def test_post_endpoint_sets_reminder(self):
        remind_on = self._future_date(45)
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/rebook-reminder/',
            {'remind_on': remind_on.isoformat(), 'note': 'Next fall'},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['rebook_reminder']['status'], 'pending')
        self.assertEqual(res.data['rebook_reminder']['note'], 'Next fall')

    def test_cancel_helper(self):
        upsert_rebook_reminder(self.booking, remind_on=self._future_date(20))
        cancel_rebook_reminder(self.booking)
        self.assertEqual(
            BookingRebookReminder.objects.get(booking=self.booking).status,
            BookingRebookReminder.Status.CANCELLED,
        )

    def test_gig_job_rejected(self):
        self.booking.job_title = 'Custom driveway work'
        self.booking.save(update_fields=['job_title'])
        with self.assertRaises(Exception):
            upsert_rebook_reminder(self.booking, remind_on=self._future_date(30))
