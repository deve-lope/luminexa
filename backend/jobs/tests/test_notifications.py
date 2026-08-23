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

    def test_provider_accept_creates_customer_notification_and_email(self):
        from django.core import mail

        from jobs.models import CustomerNotification

        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=self.slot.start_at,
            end_at=self.slot.end_at,
            status=Booking.Status.REQUESTED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        self.slot.status = AvailabilitySlot.Status.PENDING
        self.slot.save(update_fields=['status'])

        self.client.force_authenticate(user=self.provider)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/accept/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        note = CustomerNotification.objects.filter(
            customer=self.customer,
            kind=CustomerNotification.Kind.BOOKING_CONFIRMED,
        ).first()
        self.assertIsNotNone(note)
        self.assertTrue(
            any('Booking confirmed' in m.subject for m in mail.outbox),
            [m.subject for m in mail.outbox],
        )

    def test_customer_can_list_and_dismiss_notifications(self):
        from jobs.models import CustomerNotification
        from jobs.notifications import create_customer_notification

        note = create_customer_notification(
            customer=self.customer,
            kind=CustomerNotification.Kind.BOOKING_CONFIRMED,
            title='Test',
            message='Approved',
            organization=self.org,
        )
        self.client.force_authenticate(user=self.customer)
        res = self.client.get('/api/v1/me/notifications/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 1)
        dismiss = self.client.post(
            f'/api/v1/me/notifications/{note.id}/dismiss/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(dismiss.status_code, 200)
        note.refresh_from_db()
        self.assertIsNotNone(note.dismissed_at)

    def test_customer_cancel_creates_provider_notification(self):
        from jobs.models import ProviderNotification

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

        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/cancel/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        note = ProviderNotification.objects.filter(
            organization=self.org,
            kind=ProviderNotification.Kind.CUSTOMER_CANCELLED_BOOKING,
        ).first()
        self.assertIsNotNone(note)
        self.assertIn('cancelled', note.message.lower())

    def test_customer_reschedule_creates_provider_notification(self):
        from datetime import timedelta

        from jobs.models import ProviderNotification

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

        new_start = timezone.now() + timedelta(days=3)
        new_slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=new_start,
            end_at=new_start + timedelta(hours=1),
            status=AvailabilitySlot.Status.OPEN,
        )

        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/reschedule/',
            {'slot_id': new_slot.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        note = ProviderNotification.objects.filter(
            organization=self.org,
            kind=ProviderNotification.Kind.CUSTOMER_RESCHEDULE_REQUEST,
        ).first()
        self.assertIsNotNone(note)
        self.assertIn('reschedule', note.message.lower())
        self.assertEqual(note.booking_id, booking.id)
        self.assertEqual(
            note.link_path,
            f'/provider/{self.org.slug}/requests/booking/{booking.id}',
        )
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.REQUESTED)

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
        # The booking card (posted as the customer) precedes the cancellation
        # note, so select the system message rather than the first in the thread.
        msg = ServiceRequestMessage.objects.filter(
            booking=booking, kind=ServiceRequestMessage.Kind.SYSTEM,
        ).first()
        self.assertIsNotNone(msg)
        self.assertIn('cancelled', msg.body.lower())

    def test_opening_booking_thread_dismisses_related_new_message_notifications(self):
        """Reading a conversation clears new_message alerts for that booking only."""
        from jobs.models import CustomerNotification, ProviderNotification
        from jobs.notifications import create_customer_notification

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
        other_booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=self.slot.start_at + timedelta(days=1),
            end_at=self.slot.end_at + timedelta(days=1),
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        customer_note = create_customer_notification(
            customer=self.customer,
            kind=CustomerNotification.Kind.NEW_MESSAGE,
            title='New message — Test Co',
            message='Hello from provider',
            organization=self.org,
            booking=booking,
            link_path='/customer/messages',
        )
        other_customer_note = create_customer_notification(
            customer=self.customer,
            kind=CustomerNotification.Kind.NEW_MESSAGE,
            title='Other thread',
            message='Keep me',
            organization=self.org,
            booking=other_booking,
            link_path='/customer/messages',
        )
        booking_confirmed = create_customer_notification(
            customer=self.customer,
            kind=CustomerNotification.Kind.BOOKING_CONFIRMED,
            title='Confirmed',
            message='Keep me too',
            organization=self.org,
            booking=booking,
        )
        provider_note = ProviderNotification.objects.create(
            organization=self.org,
            booking=booking,
            kind=ProviderNotification.Kind.NEW_MESSAGE,
            message='Customer messaged about Oil change.',
            link_path=f'/provider/{self.org.slug}/messages?booking={booking.id}',
        )

        self.client.force_authenticate(user=self.customer)
        res = self.client.get(
            f'/api/v1/bookings/{booking.id}/messages/',
            HTTP_HOST='localhost',
            secure=True,
        )
        self.assertEqual(res.status_code, 200)
        customer_note.refresh_from_db()
        other_customer_note.refresh_from_db()
        booking_confirmed.refresh_from_db()
        provider_note.refresh_from_db()
        self.assertIsNotNone(customer_note.dismissed_at)
        # Same org↔customer chat — both new_message alerts clear when the thread is opened.
        self.assertIsNotNone(other_customer_note.dismissed_at)
        self.assertIsNone(booking_confirmed.dismissed_at)
        self.assertIsNone(provider_note.dismissed_at)

        self.client.force_authenticate(user=self.provider)
        res = self.client.get(
            f'/api/v1/bookings/{booking.id}/messages/',
            HTTP_HOST='localhost',
            secure=True,
        )
        self.assertEqual(res.status_code, 200)
        provider_note.refresh_from_db()
        self.assertIsNotNone(provider_note.dismissed_at)

    def test_opening_inquiry_thread_dismisses_related_new_message_notifications(self):
        from jobs.models import CustomerNotification, CustomerServiceInquiry, ProviderNotification
        from jobs.notifications import create_customer_notification

        inquiry = CustomerServiceInquiry.objects.create(
            organization=self.org,
            customer=self.customer,
            service_label='Custom work',
            message='Need a quote',
            status=CustomerServiceInquiry.Status.ACTIVE,
        )
        other_inquiry = CustomerServiceInquiry.objects.create(
            organization=self.org,
            customer=self.customer,
            service_label='Other work',
            message='Separate request',
            status=CustomerServiceInquiry.Status.ACTIVE,
        )
        customer_note = create_customer_notification(
            customer=self.customer,
            kind=CustomerNotification.Kind.NEW_MESSAGE,
            title='New message — Test Co',
            message='Reply on your request',
            organization=self.org,
            inquiry=inquiry,
            link_path='/customer/messages',
        )
        other_note = create_customer_notification(
            customer=self.customer,
            kind=CustomerNotification.Kind.NEW_MESSAGE,
            title='Other inquiry',
            message='Keep me',
            organization=self.org,
            inquiry=other_inquiry,
            link_path='/customer/messages',
        )
        provider_note = ProviderNotification.objects.create(
            organization=self.org,
            inquiry=inquiry,
            kind=ProviderNotification.Kind.NEW_MESSAGE,
            message='Customer messaged about Custom work.',
            link_path=f'/provider/{self.org.slug}/messages?inquiry={inquiry.id}',
        )

        self.client.force_authenticate(user=self.customer)
        res = self.client.get(
            f'/api/v1/organizations/{self.org.slug}/service-inquiries/{inquiry.id}/messages/',
            HTTP_HOST='localhost',
            secure=True,
        )
        self.assertEqual(res.status_code, 200)
        customer_note.refresh_from_db()
        other_note.refresh_from_db()
        provider_note.refresh_from_db()
        self.assertIsNotNone(customer_note.dismissed_at)
        # Same org↔customer chat — opening the thread clears all new_message alerts for that provider.
        self.assertIsNotNone(other_note.dismissed_at)
        self.assertIsNone(provider_note.dismissed_at)

        self.client.force_authenticate(user=self.provider)
        res = self.client.get(
            f'/api/v1/organizations/{self.org.slug}/service-inquiries/{inquiry.id}/messages/',
            HTTP_HOST='localhost',
            secure=True,
        )
        self.assertEqual(res.status_code, 200)
        provider_note.refresh_from_db()
        self.assertIsNotNone(provider_note.dismissed_at)

    def test_opening_booking_detail_dismisses_related_booking_update_notifications(self):
        """GET booking detail clears booking-update alerts for that booking only."""
        from jobs.models import CustomerNotification, ProviderNotification
        from jobs.notifications import create_customer_notification

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
        other_booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=self.slot.start_at + timedelta(days=1),
            end_at=self.slot.end_at + timedelta(days=1),
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        time_change = create_customer_notification(
            customer=self.customer,
            kind=CustomerNotification.Kind.BOOKING_TIME_CHANGE,
            title='New time proposed',
            message='Provider suggested a new time',
            organization=self.org,
            booking=booking,
        )
        quote_note = create_customer_notification(
            customer=self.customer,
            kind=CustomerNotification.Kind.BOOKING_CONFIRMED,
            title='Quote ready',
            message='Review your quote',
            organization=self.org,
            booking=booking,
        )
        message_note = create_customer_notification(
            customer=self.customer,
            kind=CustomerNotification.Kind.NEW_MESSAGE,
            title='New message',
            message='Keep until messages open',
            organization=self.org,
            booking=booking,
            link_path='/customer/messages',
        )
        other_note = create_customer_notification(
            customer=self.customer,
            kind=CustomerNotification.Kind.BOOKING_CANCELLED,
            title='Other booking',
            message='Keep me',
            organization=self.org,
            booking=other_booking,
        )
        provider_booking_note = ProviderNotification.objects.create(
            organization=self.org,
            booking=booking,
            kind=ProviderNotification.Kind.NEW_CUSTOMER_BOOKING,
            message='New booking request for Oil change.',
            link_path=f'/provider/{self.org.slug}/requests/booking/{booking.id}',
        )
        provider_message_note = ProviderNotification.objects.create(
            organization=self.org,
            booking=booking,
            kind=ProviderNotification.Kind.NEW_MESSAGE,
            message='Customer messaged about Oil change.',
            link_path=f'/provider/{self.org.slug}/messages?booking={booking.id}',
        )
        other_provider_note = ProviderNotification.objects.create(
            organization=self.org,
            booking=other_booking,
            kind=ProviderNotification.Kind.CUSTOMER_RESCHEDULE_REQUEST,
            message='Other booking reschedule',
            link_path=f'/provider/{self.org.slug}/requests/booking/{other_booking.id}',
        )

        self.client.force_authenticate(user=self.customer)
        res = self.client.get(
            f'/api/v1/bookings/{booking.id}/',
            HTTP_HOST='localhost',
            secure=True,
        )
        self.assertEqual(res.status_code, 200)
        time_change.refresh_from_db()
        quote_note.refresh_from_db()
        message_note.refresh_from_db()
        other_note.refresh_from_db()
        provider_booking_note.refresh_from_db()
        self.assertIsNotNone(time_change.dismissed_at)
        self.assertIsNotNone(quote_note.dismissed_at)
        self.assertIsNone(message_note.dismissed_at)
        self.assertIsNone(other_note.dismissed_at)
        self.assertIsNone(provider_booking_note.dismissed_at)

        self.client.force_authenticate(user=self.provider)
        res = self.client.get(
            f'/api/v1/bookings/{booking.id}/',
            HTTP_HOST='localhost',
            secure=True,
        )
        self.assertEqual(res.status_code, 200)
        provider_booking_note.refresh_from_db()
        provider_message_note.refresh_from_db()
        other_provider_note.refresh_from_db()
        self.assertIsNotNone(provider_booking_note.dismissed_at)
        self.assertIsNone(provider_message_note.dismissed_at)
        self.assertIsNone(other_provider_note.dismissed_at)

    def test_accept_quote_notifies_provider_and_customer(self):
        from django.core import mail

        from jobs.models import CustomerNotification, ProviderNotification

        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=self.slot.start_at,
            end_at=self.slot.end_at,
            status=Booking.Status.QUOTED,
            source=Booking.Source.CUSTOMER_REQUEST,
            quote_amount='85.00',
            quote_message='Includes parts',
        )
        self.slot.status = AvailabilitySlot.Status.PENDING
        self.slot.save(update_fields=['status'])

        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/accept-quote/',
            {},
            format='json',
            HTTP_HOST='localhost',
            secure=True,
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], Booking.Status.CONFIRMED)

        provider_note = ProviderNotification.objects.filter(
            organization=self.org,
            booking=booking,
            kind=ProviderNotification.Kind.QUOTE_ACCEPTED,
        ).first()
        self.assertIsNotNone(provider_note)
        self.assertIn('accepted', provider_note.message.lower())
        self.assertEqual(
            provider_note.link_path,
            f'/provider/{self.org.slug}/requests/booking/{booking.id}',
        )

        customer_note = CustomerNotification.objects.filter(
            customer=self.customer,
            booking=booking,
            kind=CustomerNotification.Kind.BOOKING_CONFIRMED,
        ).first()
        self.assertIsNotNone(customer_note)
        self.assertIn('Quote accepted', customer_note.title)

        subjects = [m.subject for m in mail.outbox]
        self.assertTrue(
            any('Quote accepted' in s for s in subjects),
            subjects,
        )
        self.assertTrue(
            any('Booking confirmed' in s for s in subjects),
            subjects,
        )

    def test_opening_booking_dismisses_quote_accepted_provider_notification(self):
        from jobs.models import ProviderNotification

        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=self.slot.start_at,
            end_at=self.slot.end_at,
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.CUSTOMER_REQUEST,
            quote_amount='85.00',
        )
        note = ProviderNotification.objects.create(
            organization=self.org,
            booking=booking,
            kind=ProviderNotification.Kind.QUOTE_ACCEPTED,
            message='Customer accepted $85.00 for Oil change.',
            link_path=f'/provider/{self.org.slug}/requests/booking/{booking.id}',
        )

        self.client.force_authenticate(user=self.provider)
        res = self.client.get(
            f'/api/v1/bookings/{booking.id}/',
            HTTP_HOST='localhost',
            secure=True,
        )
        self.assertEqual(res.status_code, 200)
        note.refresh_from_db()
        self.assertIsNotNone(note.dismissed_at)

