from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import AvailabilitySlot, Booking, Service


class BookingLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.provider = User.objects.create_user(
            email='provider@test.local',
            password='password123',
            full_name='Provider',
            phone='5550000001',
        )
        self.customer = User.objects.create_user(
            email='customer@test.local',
            password='password123',
            full_name='Customer',
            phone='5550000002',
        )
        self.org = Organization.objects.create(
            name='Test Co',
            slug='test-co',
            booking_policy=Organization.BookingPolicy.APPROVAL,
            profile_public=True,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.provider,
            role=OrganizationMembership.Role.OWNER,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Oil change',
            duration_minutes=60,
            base_price='49.00',
            is_active=True,
        )
        start = timezone.now() + timedelta(days=2)
        end = start + timedelta(hours=1)
        self.slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=start,
            end_at=end,
            status=AvailabilitySlot.Status.OPEN,
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_customer_request_and_provider_accept(self):
        self._auth(self.customer)
        res = self.client.post(
            '/api/v1/bookings/',
            {
                'slot_id': self.slot.id,
                'customer_notes': 'Please call first',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201)
        booking_id = res.data['id']
        booking = Booking.objects.get(pk=booking_id)
        self.assertEqual(booking.status, Booking.Status.REQUESTED)

        self._auth(self.provider)
        accept = self.client.post(f'/api/v1/bookings/{booking_id}/accept/', HTTP_HOST='localhost')
        self.assertEqual(accept.status_code, 200)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)

    def test_customer_cancel_confirmed_booking(self):
        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=self.slot.start_at,
            end_at=self.slot.end_at,
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        self.slot.status = AvailabilitySlot.Status.BOOKED
        self.slot.save()

        self._auth(self.customer)
        res = self.client.post(f'/api/v1/bookings/{booking.id}/cancel/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.status, AvailabilitySlot.Status.OPEN)

    def test_provider_complete_booking(self):
        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=self.slot.start_at,
            end_at=self.slot.end_at,
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.PROVIDER_DIRECT,
        )
        self._auth(self.provider)
        res = self.client.post(f'/api/v1/bookings/{booking.id}/complete/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.COMPLETED)
