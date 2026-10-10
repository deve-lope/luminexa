from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import Booking, Service


@override_settings(SECURE_SSL_REDIRECT=False)
class ProviderDashboardUpcomingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.provider = User.objects.create_user(
            email='dash-provider@test.local',
            password='password123',
            full_name='Provider',
            phone='5550000201',
        )
        self.customer = User.objects.create_user(
            email='dash-customer@test.local',
            password='password123',
            full_name='Customer',
            phone='5550000202',
        )
        self.org = Organization.objects.create(
            name='Dash Co',
            slug='dash-co',
            timezone='America/Toronto',
            booking_policy=Organization.BookingPolicy.APPROVAL,
            profile_public=True,
            is_active=True,
            subscription_status='active',
            subscription_plan='pro_monthly',
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.provider,
            role=OrganizationMembership.Role.OWNER,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Visit',
            duration_minutes=60,
            base_price='40.00',
            is_active=True,
        )

    def test_overdue_confirmed_job_still_on_today_dashboard(self):
        start = timezone.now() - timedelta(minutes=5)
        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start,
            end_at=start + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.PROVIDER_DIRECT,
            service_address='1 Main St',
        )
        self.client.force_authenticate(user=self.provider)
        res = self.client.get(
            f'/api/v1/provider-dashboard/?organization={self.org.slug}',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, getattr(res, 'data', res.content))
        ids = [row['id'] for row in res.data.get('upcoming_jobs') or []]
        self.assertIn(booking.id, ids)
        self.assertGreaterEqual(res.data['stats']['jobs_today'], 1)

    def test_provider_direct_awaiting_customer_not_in_attention(self):
        """Booked-by-provider invites wait on the customer — not provider review."""
        start = timezone.now() + timedelta(days=1)
        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start,
            end_at=start + timedelta(hours=1),
            status=Booking.Status.REQUESTED,
            source=Booking.Source.PROVIDER_DIRECT,
            awaiting_customer_acceptance=True,
            service_address='1 Main St',
        )
        customer_request = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start + timedelta(hours=2),
            end_at=start + timedelta(hours=3),
            status=Booking.Status.REQUESTED,
            source=Booking.Source.CUSTOMER_REQUEST,
            service_address='2 Main St',
        )
        self.client.force_authenticate(user=self.provider)
        res = self.client.get(
            f'/api/v1/provider-dashboard/?organization={self.org.slug}',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, getattr(res, 'data', res.content))
        pending_ids = [row['id'] for row in res.data.get('pending_requests') or []]
        self.assertNotIn(booking.id, pending_ids)
        self.assertIn(customer_request.id, pending_ids)
        self.assertEqual(res.data['stats']['pending_requests_count'], 1)
