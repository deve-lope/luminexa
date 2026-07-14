from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import AvailabilitySlot, Booking, ProviderNotification, Service


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class BookingNotificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.provider = User.objects.create_user(
            email='provider@test.local',
            password='password123',
            full_name='Provider',
            phone='5550000001',
            public_ref='cus9001',
        )
        self.customer = User.objects.create_user(
            email='customer@test.local',
            password='password123',
            full_name='Customer',
            phone='5550000002',
            public_ref='cus9002',
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

    def test_provider_receives_email_when_customer_books(self):
        self.client.force_authenticate(user=self.customer)
        with patch('jobs.notifications.notify_customer_booking_created') as notify:
            res = self.client.post(
                '/api/v1/bookings/',
                {
                    'slot_id': self.slot.id,
                    'customer_notes': 'Please call first',
                    'service_address': '123 Main St',
                },
                format='json',
                HTTP_HOST='localhost',
            )
        self.assertEqual(res.status_code, 201)
        notify.assert_called_once()
        booking = notify.call_args[0][0]
        self.assertEqual(booking.status, Booking.Status.REQUESTED)

    def test_booking_requested_emails_provider_staff(self):
        from django.core import mail

        from jobs.notifications import notify_customer_booking_created

        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=self.slot.start_at,
            end_at=self.slot.end_at,
            status=Booking.Status.REQUESTED,
            source=Booking.Source.CUSTOMER_REQUEST,
            service_address='123 Main St',
        )
        notify_customer_booking_created(booking)

        subjects = [m.subject for m in mail.outbox]
        self.assertIn('New booking request — Oil change', subjects)
        self.assertIn('Booking request sent — Test Co', subjects)
        provider_mail = next(m for m in mail.outbox if m.to == ['provider@test.local'])
        self.assertIn('123 Main St', provider_mail.body)
        note = ProviderNotification.objects.get(
            organization=self.org,
            kind=ProviderNotification.Kind.NEW_CUSTOMER_BOOKING,
        )
        self.assertIn('Customer requested Oil change', note.message)

    def test_provider_cancel_emails_customer(self):
        from django.core import mail

        from jobs.models import ServiceRequestMessage

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
        self.slot.save(update_fields=['status'])

        self.client.force_authenticate(user=self.provider)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/cancel/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)

        customer_mails = [m for m in mail.outbox if m.to == ['customer@test.local']]
        self.assertTrue(customer_mails)
        self.assertTrue(
            any('Booking cancelled' in m.subject for m in customer_mails),
            [m.subject for m in mail.outbox],
        )
        msg = ServiceRequestMessage.objects.filter(booking=booking).first()
        self.assertIsNotNone(msg)
        self.assertIn('cancelled', msg.body.lower())
