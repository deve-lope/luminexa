from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import AvailabilitySlot, Booking, BookingStatusEvent, Service


class AbuseControlsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-abuse@test.local',
            password='pass12345',
            full_name='Owner',
            phone='5551000001',
        )
        self.customer = User.objects.create_user(
            email='cust-abuse@test.local',
            password='pass12345',
            full_name='Cust',
            phone='5551000002',
        )
        self.org = Organization.objects.create(
            name='Abuse Co',
            slug='abuse-co',
            booking_policy=Organization.BookingPolicy.INSTANT,
            profile_public=True,
            is_active=True,
            cancel_cutoff_hours=24,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        self.membership = OrganizationMembership.objects.create(
            organization=self.org,
            user=self.customer,
            role=OrganizationMembership.Role.CUSTOMER,
            customer_status=OrganizationMembership.CustomerStatus.APPROVED,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Cut',
            duration_minutes=60,
            base_price='20',
            is_active=True,
        )

    def _booking(self, *, hours_ahead=48, status=Booking.Status.CONFIRMED):
        start = timezone.now() + timedelta(hours=hours_ahead)
        end = start + timedelta(hours=1)
        return Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start,
            end_at=end,
            status=status,
            source=Booking.Source.CUSTOMER_REQUEST,
        )

    def test_customer_cannot_cancel_within_cutoff(self):
        booking = self._booking(hours_ahead=12)
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/cancel/',
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)

    def test_customer_can_cancel_outside_cutoff(self):
        booking = self._booking(hours_ahead=48)
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/cancel/',
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)

    def test_requested_booking_ignores_cutoff(self):
        booking = self._booking(hours_ahead=6, status=Booking.Status.REQUESTED)
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/cancel/',
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)

    def test_block_customer_prevents_booking(self):
        start = timezone.now() + timedelta(days=2)
        end = start + timedelta(hours=1)
        slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            status=AvailabilitySlot.Status.OPEN,
            start_at=start,
            end_at=end,
        )
        self.membership.customer_status = OrganizationMembership.CustomerStatus.BLOCKED
        self.membership.save(update_fields=['customer_status'])
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': slot.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 403)

    def test_block_and_customer_counts(self):
        booking = self._booking(hours_ahead=72)
        BookingStatusEvent.objects.create(
            booking=booking,
            actor=self.customer,
            action=BookingStatusEvent.Action.CANCELLED,
            old_status=Booking.Status.CONFIRMED,
            new_status=Booking.Status.CANCELLED,
        )
        no_show = self._booking(hours_ahead=96)
        BookingStatusEvent.objects.create(
            booking=no_show,
            actor=self.owner,
            action=BookingStatusEvent.Action.NO_SHOW,
            old_status=Booking.Status.CONFIRMED,
            new_status=Booking.Status.CANCELLED,
        )
        self.client.force_authenticate(user=self.owner)
        listed = self.client.get(
            f'/api/v1/organizations/{self.org.slug}/customers/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(listed.status_code, 200)
        row = next(r for r in listed.data if r['id'] == self.customer.id)
        self.assertEqual(row['cancel_count'], 1)
        self.assertEqual(row['no_show_count'], 1)

        blocked = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/block-customer/',
            {'user_id': self.customer.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(blocked.status_code, 200)
        self.membership.refresh_from_db()
        self.assertEqual(
            self.membership.customer_status,
            OrganizationMembership.CustomerStatus.BLOCKED,
        )

        unblocked = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/unblock-customer/',
            {'user_id': self.customer.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(unblocked.status_code, 200)
        self.membership.refresh_from_db()
        self.assertEqual(
            self.membership.customer_status,
            OrganizationMembership.CustomerStatus.APPROVED,
        )

    def test_owner_can_update_cancel_cutoff(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(
            f'/api/v1/organizations/{self.org.slug}/',
            {'cancel_cutoff_hours': 48},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.cancel_cutoff_hours, 48)
