from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from businesses.models import Organization
from jobs.models import Booking, ProviderNotification, Service, Task
from jobs.notifications import send_task_due_reminders_for_window


class TaskDueReminderTests(TestCase):
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

    def _booking(self):
        start_at = timezone.now() + timedelta(days=3)
        return Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_24h_reminder_for_open_task(self, push_mock):
        due_at = timezone.now() + timedelta(hours=24, minutes=15)
        task = Task.objects.create(
            organization=self.org,
            title='Buy mulch',
            due_at=due_at,
            is_done=False,
        )

        sent = send_task_due_reminders_for_window(hours_ahead=24, window_hours=1)

        self.assertEqual(sent, 1)
        push_mock.assert_called_once()
        note = ProviderNotification.objects.get(
            organization=self.org,
            kind=ProviderNotification.Kind.TASK_DUE,
        )
        self.assertIn('Buy mulch', note.message)
        self.assertIn('24 hours', note.message)
        self.assertEqual(note.link_path, '/provider/garden-co/tasks')
        task.refresh_from_db()
        self.assertIsNotNone(task.due_reminder_sent_at)

        sent_again = send_task_due_reminders_for_window(hours_ahead=24, window_hours=1)
        self.assertEqual(sent_again, 0)
        self.assertEqual(
            ProviderNotification.objects.filter(
                kind=ProviderNotification.Kind.TASK_DUE,
            ).count(),
            1,
        )

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_job_linked_task_links_to_jobs(self, push_mock):
        booking = self._booking()
        due_at = timezone.now() + timedelta(hours=24, minutes=20)
        Task.objects.create(
            organization=self.org,
            job=booking,
            title='Confirm tools',
            due_at=due_at,
            is_done=False,
        )

        sent = send_task_due_reminders_for_window(hours_ahead=24, window_hours=1)

        self.assertEqual(sent, 1)
        note = ProviderNotification.objects.get(kind=ProviderNotification.Kind.TASK_DUE)
        self.assertEqual(note.booking_id, booking.id)
        self.assertEqual(note.link_path, '/provider/garden-co/jobs')
        self.assertIn('Lawn care', note.message)
        push_mock.assert_called_once()

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_skips_done_tasks(self, push_mock):
        Task.objects.create(
            organization=self.org,
            title='Already done',
            due_at=timezone.now() + timedelta(hours=24, minutes=10),
            is_done=True,
            done_at=timezone.now(),
        )

        sent = send_task_due_reminders_for_window(hours_ahead=24, window_hours=1)

        self.assertEqual(sent, 0)
        push_mock.assert_not_called()
        self.assertFalse(
            ProviderNotification.objects.filter(
                kind=ProviderNotification.Kind.TASK_DUE,
            ).exists()
        )

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_skips_outside_24h_window(self, push_mock):
        Task.objects.create(
            organization=self.org,
            title='Too early',
            due_at=timezone.now() + timedelta(hours=48),
            is_done=False,
        )

        sent = send_task_due_reminders_for_window(hours_ahead=24, window_hours=1)

        self.assertEqual(sent, 0)
        push_mock.assert_not_called()
