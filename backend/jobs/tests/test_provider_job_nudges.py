from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from businesses.models import Organization
from jobs.models import Booking, ProviderNotification, Service
from jobs.notifications import send_provider_job_nudges


class ProviderJobNudgeTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email='customer-nudge@test.local',
            password='password123',
            full_name='Pat Customer',
            phone='5550000099',
        )
        self.org = Organization.objects.create(
            name='Nudge Co',
            slug='nudge-co',
            timezone='America/Toronto',
            profile_public=True,
            is_active=True,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='House clean',
            duration_minutes=60,
            base_price='80.00',
            is_active=True,
        )

    def _booking(self, *, start_at, status=Booking.Status.CONFIRMED, **extra):
        return Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
            status=status,
            source=Booking.Source.CUSTOMER_REQUEST,
            **extra,
        )

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_one_hour_reminder(self, push_mock):
        now = timezone.now()
        booking = self._booking(start_at=now + timedelta(minutes=65))

        sent = send_provider_job_nudges(now=now)

        self.assertEqual(sent, 1)
        note = ProviderNotification.objects.get(
            booking=booking,
            kind=ProviderNotification.Kind.JOB_STARTING_SOON,
        )
        self.assertIn('1 hour', note.message)
        self.assertEqual(
            note.link_path,
            f'/provider/{self.org.slug}/schedule/booking/{booking.pk}',
        )
        booking.refresh_from_db()
        self.assertIsNotNone(booking.provider_1h_reminder_sent_at)
        push_mock.assert_called()

        self.assertEqual(send_provider_job_nudges(now=now), 0)

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_thirty_minute_en_route_nudge(self, push_mock):
        now = timezone.now()
        booking = self._booking(start_at=now + timedelta(minutes=35))

        sent = send_provider_job_nudges(now=now)

        self.assertEqual(sent, 1)
        note = ProviderNotification.objects.get(
            booking=booking,
            kind=ProviderNotification.Kind.JOB_EN_ROUTE_NUDGE,
        )
        self.assertIn('on the way', note.message.lower())
        booking.refresh_from_db()
        self.assertIsNotNone(booking.provider_en_route_nudge_sent_at)

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_en_route_nudge_skipped_when_already_sharing(self, push_mock):
        now = timezone.now()
        booking = self._booking(
            start_at=now + timedelta(minutes=35),
            en_route_at=now - timedelta(minutes=5),
        )

        sent = send_provider_job_nudges(now=now)

        self.assertEqual(sent, 0)
        self.assertFalse(
            ProviderNotification.objects.filter(
                kind=ProviderNotification.Kind.JOB_EN_ROUTE_NUDGE,
            ).exists()
        )
        booking.refresh_from_db()
        self.assertIsNone(booking.provider_en_route_nudge_sent_at)

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_start_overdue_after_thirty_minutes(self, push_mock):
        now = timezone.now()
        booking = self._booking(start_at=now - timedelta(minutes=35))

        sent = send_provider_job_nudges(now=now)

        self.assertEqual(sent, 1)
        note = ProviderNotification.objects.get(
            booking=booking,
            kind=ProviderNotification.Kind.JOB_START_OVERDUE,
        )
        self.assertIn('started', note.message.lower())
        self.assertIn('make it', note.message.lower())
        booking.refresh_from_db()
        self.assertIsNotNone(booking.provider_start_overdue_sent_at)
        self.assertEqual(send_provider_job_nudges(now=now), 0)

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_overdue_skipped_once_job_started(self, push_mock):
        now = timezone.now()
        self._booking(
            start_at=now - timedelta(minutes=35),
            status=Booking.Status.IN_PROGRESS,
        )

        sent = send_provider_job_nudges(now=now)

        self.assertEqual(sent, 0)
        self.assertFalse(
            ProviderNotification.objects.filter(
                kind=ProviderNotification.Kind.JOB_START_OVERDUE,
            ).exists()
        )

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_outside_windows_not_notified(self, push_mock):
        now = timezone.now()
        self._booking(start_at=now + timedelta(hours=3))
        self._booking(start_at=now + timedelta(minutes=5))
        self._booking(start_at=now - timedelta(minutes=10))

        sent = send_provider_job_nudges(now=now)

        self.assertEqual(sent, 0)
        self.assertEqual(ProviderNotification.objects.count(), 0)
