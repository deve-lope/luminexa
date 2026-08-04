from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import AvailabilitySlot, Booking, CustomerServiceInquiry, Service, ServiceRequestMessage


class CustomerConversationsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-conv@test.local',
            password='password123',
            full_name='Owner',
            phone='5551000001',
            public_ref='cus9101',
        )
        self.customer = User.objects.create_user(
            email='customer-conv@test.local',
            password='password123',
            full_name='Customer',
            phone='5551000002',
            public_ref='cus9102',
        )
        self.stranger = User.objects.create_user(
            email='stranger-conv@test.local',
            password='password123',
            full_name='Stranger',
            phone='5551000003',
            public_ref='cus9103',
        )
        self.org = Organization.objects.create(
            name='Conv Co',
            slug='conv-co',
            booking_policy=Organization.BookingPolicy.APPROVAL,
            profile_public=True,
            is_active=True,
            public_ref='pro9101',
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Deep clean',
            duration_minutes=60,
            base_price='80.00',
            is_active=True,
            allow_request=True,
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
        self.booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=start,
            end_at=end,
            status=Booking.Status.CONFIRMED,
            service_address='123 Main St',
        )
        self.inquiry = CustomerServiceInquiry.objects.create(
            organization=self.org,
            customer=self.customer,
            service=self.service,
            message='Need a quote',
            service_address='123 Main St',
        )

    def test_requires_authentication(self):
        res = self.client.get('/api/v1/me/conversations/', HTTP_HOST='localhost')
        self.assertIn(res.status_code, (401, 403))

    def test_only_returns_customer_owned_threads(self):
        ServiceRequestMessage.objects.create(
            booking=self.booking,
            sender=self.owner,
            body='We confirmed your booking.',
        )
        self.client.force_authenticate(user=self.stranger)
        res = self.client.get('/api/v1/me/conversations/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 0)
        self.assertEqual(res.data['results'], [])

    def test_mixed_booking_and_inquiry_ordered_by_latest_message(self):
        older = timezone.now() - timedelta(hours=2)
        newer = timezone.now() - timedelta(minutes=5)

        booking_msg = ServiceRequestMessage.objects.create(
            booking=self.booking,
            sender=self.owner,
            body='Older booking note',
        )
        ServiceRequestMessage.objects.filter(pk=booking_msg.pk).update(created_at=older)

        inquiry_msg = ServiceRequestMessage.objects.create(
            inquiry=self.inquiry,
            sender=self.customer,
            body='Newer inquiry reply with enough text for a preview',
        )
        ServiceRequestMessage.objects.filter(pk=inquiry_msg.pk).update(created_at=newer)

        # Extra older message on booking should not create a second summary.
        extra = ServiceRequestMessage.objects.create(
            booking=self.booking,
            sender=self.customer,
            body='Even older booking chatter',
        )
        ServiceRequestMessage.objects.filter(pk=extra.pk).update(
            created_at=older - timedelta(hours=1),
        )

        self.client.force_authenticate(user=self.customer)
        res = self.client.get('/api/v1/me/conversations/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 2)
        results = res.data['results']
        self.assertEqual(results[0]['kind'], 'inquiry')
        self.assertEqual(results[0]['id'], self.inquiry.id)
        self.assertEqual(results[0]['subject'], 'Deep clean')
        self.assertEqual(results[0]['organization_slug'], 'conv-co')
        self.assertIn('Newer inquiry reply', results[0]['last_message_preview'])
        self.assertEqual(results[0]['last_sender_name'], 'Customer')

        self.assertEqual(results[1]['kind'], 'booking')
        self.assertEqual(results[1]['id'], self.booking.id)
        self.assertEqual(results[1]['last_message_preview'], 'Older booking note')
        self.assertEqual(results[1]['reference'], f'BK-{self.booking.pk:05d}')
        self.assertTrue(results[1]['has_unread'])
        self.assertFalse(results[0]['has_unread'])
        self.assertEqual(res.data['unread_count'], 1)

    def test_opening_messages_marks_customer_thread_read(self):
        ServiceRequestMessage.objects.create(
            booking=self.booking,
            sender=self.owner,
            body='Hello from the shop',
        )
        self.client.force_authenticate(user=self.customer)
        list_before = self.client.get('/api/v1/me/conversations/', HTTP_HOST='localhost')
        self.assertTrue(list_before.data['results'][0]['has_unread'])
        self.assertEqual(list_before.data['unread_count'], 1)

        open_res = self.client.get(
            f'/api/v1/bookings/{self.booking.id}/messages/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(open_res.status_code, 200)

        list_after = self.client.get('/api/v1/me/conversations/', HTTP_HOST='localhost')
        self.assertFalse(list_after.data['results'][0]['has_unread'])
        self.assertEqual(list_after.data['unread_count'], 0)


class ProviderConversationsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-pconv@test.local',
            password='password123',
            full_name='Owner',
            phone='5552000001',
            public_ref='cus9201',
        )
        self.customer = User.objects.create_user(
            email='customer-pconv@test.local',
            password='password123',
            full_name='Customer',
            phone='5552000002',
            public_ref='cus9202',
        )
        self.org = Organization.objects.create(
            name='Prov Conv Co',
            slug='prov-conv-co',
            booking_policy=Organization.BookingPolicy.APPROVAL,
            profile_public=True,
            is_active=True,
            public_ref='pro9201',
            subscription_status='active',
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Tune up',
            duration_minutes=60,
            base_price='90.00',
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
        self.booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=start,
            end_at=end,
            status=Booking.Status.CONFIRMED,
            service_address='456 Oak St',
        )

    def test_customer_message_creates_provider_notification_and_unread(self):
        from jobs.models import ProviderNotification

        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/messages/',
            {'body': 'Can you arrive earlier?'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)

        note = ProviderNotification.objects.filter(
            organization=self.org,
            kind=ProviderNotification.Kind.NEW_MESSAGE,
        ).first()
        self.assertIsNotNone(note)
        self.assertIn('Customer', note.message)
        self.assertEqual(note.booking_id, self.booking.id)
        self.assertEqual(
            note.link_path,
            f'/provider/{self.org.slug}/messages?booking={self.booking.id}',
        )

        self.client.force_authenticate(user=self.owner)
        inbox = self.client.get(
            f'/api/v1/organizations/{self.org.slug}/conversations/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(inbox.status_code, 200)
        self.assertEqual(inbox.data['count'], 1)
        self.assertEqual(inbox.data['unread_count'], 1)
        self.assertTrue(inbox.data['results'][0]['has_unread'])

        open_res = self.client.get(
            f'/api/v1/bookings/{self.booking.id}/messages/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(open_res.status_code, 200)

        inbox_after = self.client.get(
            f'/api/v1/organizations/{self.org.slug}/conversations/',
            HTTP_HOST='localhost',
        )
        self.assertFalse(inbox_after.data['results'][0]['has_unread'])
        self.assertEqual(inbox_after.data['unread_count'], 0)

    def test_provider_message_creates_customer_notification(self):
        from jobs.models import CustomerNotification

        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/messages/',
            {'body': 'We will be there at 9.'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)

        note = CustomerNotification.objects.filter(
            customer=self.customer,
            kind=CustomerNotification.Kind.NEW_MESSAGE,
        ).first()
        self.assertIsNotNone(note)
        self.assertEqual(note.link_path, '/customer/messages')

        self.client.force_authenticate(user=self.customer)
        inbox = self.client.get('/api/v1/me/conversations/', HTTP_HOST='localhost')
        self.assertTrue(inbox.data['results'][0]['has_unread'])
        self.assertEqual(inbox.data['unread_count'], 1)
