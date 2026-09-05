from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from businesses.models import Organization
from jobs.models import Booking, ProviderNotification, Service, Task
from jobs.notifications import send_incomplete_job_task_reminders_for_window


class IncompleteJobTaskReminderTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email='customer@test.local',
            password='password123',
            full_name='Jane Customer',
            phone='5550000002',
        )
        self.org = Organization.objects.create(
            name='Garden Co',
            slug='garden-co',
            timezone='America/Toronto',
            profile_public=True,
            is_active=True,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Lawn care',
            duration_minutes=60,
            base_price='49.00',
            is_active=True,
        )

    def _booking(self, *, hours_ahead, status=Booking.Status.CONFIRMED):
        start_at = timezone.now() + timedelta(hours=hours_ahead, minutes=15)
        return Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
            status=status,
            source=Booking.Source.CUSTOMER_REQUEST,
        )

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_two_day_reminder_when_open_tasks_exist(self, push_mock):
        booking = self._booking(hours_ahead=48)
        Task.objects.create(
            organization=self.org,
            job=booking,
            title='Buy mulch',
            is_done=False,
        )
        Task.objects.create(
            organization=self.org,
            job=booking,
            title='Confirm tools',
            is_done=True,
            done_at=timezone.now(),
        )

        sent = send_incomplete_job_task_reminders_for_window(hours_ahead=48, window_hours=1)

        self.assertEqual(sent, 1)
        push_mock.assert_called_once()
        note = ProviderNotification.objects.get(
            booking=booking,
            kind=ProviderNotification.Kind.INCOMPLETE_JOB_TASKS,
        )
        self.assertIn('1 incomplete task', note.message)
        self.assertIn('/provider/garden-co/jobs', note.link_path)
        booking.refresh_from_db()
        self.assertIsNotNone(booking.incomplete_tasks_reminder_sent_at)

        # Idempotent — sentinel blocks a second send.
        sent_again = send_incomplete_job_task_reminders_for_window(hours_ahead=48, window_hours=1)
        self.assertEqual(sent_again, 0)
        self.assertEqual(
            ProviderNotification.objects.filter(
                booking=booking,
                kind=ProviderNotification.Kind.INCOMPLETE_JOB_TASKS,
            ).count(),
            1,
        )

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_skips_when_all_tasks_done(self, push_mock):
        booking = self._booking(hours_ahead=48)
        Task.objects.create(
            organization=self.org,
            job=booking,
            title='Prep done',
            is_done=True,
            done_at=timezone.now(),
        )

        sent = send_incomplete_job_task_reminders_for_window(hours_ahead=48, window_hours=1)

        self.assertEqual(sent, 0)
        push_mock.assert_not_called()
        self.assertFalse(
            ProviderNotification.objects.filter(
                kind=ProviderNotification.Kind.INCOMPLETE_JOB_TASKS,
            ).exists()
        )
        booking.refresh_from_db()
        self.assertIsNone(booking.incomplete_tasks_reminder_sent_at)

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_skips_outside_48h_window(self, push_mock):
        booking = self._booking(hours_ahead=24)
        Task.objects.create(
            organization=self.org,
            job=booking,
            title='Too late',
            is_done=False,
        )

        sent = send_incomplete_job_task_reminders_for_window(hours_ahead=48, window_hours=1)

        self.assertEqual(sent, 0)
        push_mock.assert_not_called()
        booking.refresh_from_db()
        self.assertIsNone(booking.incomplete_tasks_reminder_sent_at)
