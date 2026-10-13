from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import Booking, Service


@override_settings(SECURE_SSL_REDIRECT=False)
class CustomerHomeUpcomingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            email='home-customer@test.local',
            password='password123',
            full_name='Customer',
            phone='5550000302',
        )
        self.org = Organization.objects.create(
            name='Home Co',
            slug='home-co',
            booking_policy=Organization.BookingPolicy.APPROVAL,
            profile_public=True,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.customer,
            role=OrganizationMembership.Role.CUSTOMER,
            customer_status=OrganizationMembership.CustomerStatus.APPROVED,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Visit',
            duration_minutes=60,
            base_price='40.00',
            is_active=True,
        )

    def test_overdue_confirmed_and_en_route_stay_on_home(self):
        start = timezone.now() - timedelta(minutes=10)
        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start,
            end_at=start + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.CUSTOMER_REQUEST,
            service_address='1 Main St',
            en_route_at=timezone.now(),
            en_route_distance_km='3.50',
        )
        self.client.force_authenticate(user=self.customer)
        res = self.client.get('/api/v1/customer/home/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200, getattr(res, 'data', res.content))
        rows = res.data.get('upcoming_bookings') or []
        ids = [row['id'] for row in rows]
        self.assertIn(booking.id, ids)
        row = next(r for r in rows if r['id'] == booking.id)
        self.assertTrue(row.get('en_route_active'))
