from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from businesses.models import Organization
from jobs.models import Booking, Service
from jobs.service_request_views import _booking_bucket, _booking_day_is_past


class BookingArchiveBucketTests(TestCase):
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
            name='Trim',
            duration_minutes=60,
            base_price='40.00',
            is_active=True,
        )

    def _booking(self, *, start_at, status=Booking.Status.CONFIRMED):
        return Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
            status=status,
            source=Booking.Source.CUSTOMER_REQUEST,
        )

    def test_future_confirmed_stays_active(self):
        booking = self._booking(start_at=timezone.now() + timedelta(days=2))
        self.assertEqual(_booking_bucket(booking), 'active')
        self.assertFalse(_booking_day_is_past(booking))

    def test_past_day_confirmed_goes_to_archive(self):
        tz = ZoneInfo('America/Toronto')
        local_yesterday = timezone.localtime(timezone.now(), tz).date() - timedelta(days=1)
        start_at = timezone.make_aware(datetime.combine(local_yesterday, time(10, 0)), tz)
        booking = self._booking(start_at=start_at)
        self.assertTrue(_booking_day_is_past(booking))
        self.assertEqual(_booking_bucket(booking), 'archive')

    def test_same_day_confirmed_stays_active(self):
        tz = ZoneInfo('America/Toronto')
        today = timezone.localtime(timezone.now(), tz).date()
        start_at = timezone.make_aware(datetime.combine(today, time(8, 0)), tz)
        booking = self._booking(start_at=start_at)
        self.assertFalse(_booking_day_is_past(booking))
        self.assertEqual(_booking_bucket(booking), 'active')

    def test_past_completed_stays_done(self):
        booking = self._booking(
            start_at=timezone.now() - timedelta(days=3),
            status=Booking.Status.COMPLETED,
        )
        self.assertEqual(_booking_bucket(booking), 'done')

    def test_past_cancelled_is_other(self):
        booking = self._booking(
            start_at=timezone.now() - timedelta(days=3),
            status=Booking.Status.CANCELLED,
        )
        self.assertEqual(_booking_bucket(booking), 'other')

    def test_needs_return_stays_active_even_if_past(self):
        booking = self._booking(
            start_at=timezone.now() - timedelta(days=3),
            status=Booking.Status.NEEDS_RETURN,
        )
        self.assertEqual(_booking_bucket(booking), 'active')
