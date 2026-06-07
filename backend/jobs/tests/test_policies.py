from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import AvailabilitySlot, Booking, CustomerServiceInquiry, Service


class BookingPolicyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner@test.local', password='pass12345', full_name='Owner', phone='5550000001',
        )
        self.customer = User.objects.create_user(
            email='cust@test.local', password='pass12345', full_name='Cust', phone='5550000002',
        )
        start = timezone.now() + timedelta(days=3)
        end = start + timedelta(hours=1)
        self.slot_kwargs = dict(start_at=start, end_at=end)

    def _org(self, policy):
        org = Organization.objects.create(
            name='Policy Co', slug=f'policy-{policy}', booking_policy=policy,
            profile_public=True, is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=org, user=self.owner, role=OrganizationMembership.Role.OWNER,
        )
        service = Service.objects.create(
            organization=org, name='Test', duration_minutes=60, base_price='10', is_active=True,
        )
        slot = AvailabilitySlot.objects.create(
            organization=org, service=service, status=AvailabilitySlot.Status.OPEN, **self.slot_kwargs,
        )
        return org, service, slot

    def test_instant_booking_confirms_immediately(self):
        org, _service, slot = self._org(Organization.BookingPolicy.INSTANT)
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': slot.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['status'], Booking.Status.CONFIRMED)

    def test_clients_only_blocks_booking_until_approved(self):
        org, _service, slot = self._org(Organization.BookingPolicy.CLIENTS_ONLY)
        OrganizationMembership.objects.create(
            organization=org,
            user=self.customer,
            role=OrganizationMembership.Role.CUSTOMER,
            customer_status=OrganizationMembership.CustomerStatus.PENDING,
        )
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': slot.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 403)


class ServiceInquiryPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            email='inq@test.local', password='pass12345', full_name='Inq', phone='5550000003',
        )
        self.org = Organization.objects.create(
            name='Inq Co', slug='inq-co', booking_policy=Organization.BookingPolicy.INSTANT,
            profile_public=True, is_active=True,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Clean',
            duration_minutes=60,
            base_price='20',
            is_active=True,
            allow_request=True,
        )

    def test_service_inquiry_creates_membership_for_open_policy(self):
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/service-inquiry/',
            {
                'service_id': self.service.id,
                'message': 'Need help with cleaning please',
                'service_address': '123 Main St',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(
            OrganizationMembership.objects.filter(
                organization=self.org,
                user=self.customer,
                role=OrganizationMembership.Role.CUSTOMER,
            ).exists()
        )
        self.assertEqual(CustomerServiceInquiry.objects.filter(organization=self.org).count(), 1)
