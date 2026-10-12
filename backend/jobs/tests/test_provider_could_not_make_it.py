from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.booking_services import cancel_booking, mark_provider_could_not_make_it
from jobs.models import Booking, BookingStatusEvent, CustomerNotification, Service
from rest_framework.exceptions import ValidationError


class ProviderCouldNotMakeItTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-cnmi@test.local',
            password='password123',
            full_name='Owner',
            phone='5550000101',
        )
        self.customer = User.objects.create_user(
            email='cust-cnmi@test.local',
            password='password123',
            full_name='Customer',
            phone='5550000102',
        )
        self.org = Organization.objects.create(
            name='CNMI Co',
            slug='cnmi-co',
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
            name='Repair',
            duration_minutes=60,
            base_price='90.00',
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

    def test_cancel_blocked_after_start(self):
        booking = self._booking(start_at=timezone.now() - timedelta(hours=2))
        with self.assertRaises(ValidationError):
            cancel_booking(booking, by_user=self.owner)

    @patch('jobs.notifications.send_booking_email')
    @patch('jobs.message_services.post_booking_cancellation_message')
    def test_could_not_make_it_closes_past_confirmed(self, msg_mock, email_mock):
        booking = self._booking(start_at=timezone.now() - timedelta(hours=2))
        mark_provider_could_not_make_it(
            booking, staff_user=self.owner, reason='Emergency',
        )
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)
        self.assertIn('Provider could not make this appointment', booking.customer_notes)
        self.assertIn('Emergency', booking.customer_notes)

    def test_could_not_make_it_rejected_before_start(self):
        booking = self._booking(start_at=timezone.now() + timedelta(hours=2))
        with self.assertRaises(ValidationError):
            mark_provider_could_not_make_it(booking, staff_user=self.owner)

    @patch('jobs.push_services.send_push_to_user')
    @patch('jobs.notifications.send_booking_email')
    @patch('jobs.message_services.post_booking_cancellation_message')
    def test_api_endpoint(self, msg_mock, email_mock, push_mock):
        booking = self._booking(start_at=timezone.now() - timedelta(minutes=45))
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/could-not-make-it/',
            {'reason': 'Vehicle broke down'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)
        event = BookingStatusEvent.objects.get(
            booking=booking,
            action=BookingStatusEvent.Action.PROVIDER_COULD_NOT_MAKE_IT,
        )
        self.assertIn('Vehicle', event.note)
        note = CustomerNotification.objects.filter(
            booking=booking,
            kind=CustomerNotification.Kind.BOOKING_CANCELLED,
        ).latest('id')
        self.assertIn('Provider', note.title)
        self.assertIn('make', note.message.lower())
        # Not counted as customer no-show
        self.assertFalse(
            BookingStatusEvent.objects.filter(
                booking=booking,
                action=BookingStatusEvent.Action.NO_SHOW,
            ).exists()
        )
