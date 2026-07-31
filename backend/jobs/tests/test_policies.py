from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import AvailabilitySlot, Booking, CustomerServiceInquiry, Service, ServiceRequestMessage, WeeklyScheduleBlock
from jobs.scheduling_services import sync_recurring_slots


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
        org, service, slot = self._org(Organization.BookingPolicy.INSTANT)
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            '/api/v1/bookings/',
            {
                'slot_id': slot.id,
                'service': service.id,
                'service_address': '123 Main St, Ottawa, ON K1A 0B1',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['status'], Booking.Status.CONFIRMED)

    def test_clients_only_allows_pending_booking_request(self):
        org, service, slot = self._org(Organization.BookingPolicy.CLIENTS_ONLY)
        OrganizationMembership.objects.create(
            organization=org,
            user=self.customer,
            role=OrganizationMembership.Role.CUSTOMER,
            customer_status=OrganizationMembership.CustomerStatus.PENDING,
        )
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            '/api/v1/bookings/',
            {
                'slot_id': slot.id,
                'service': service.id,
                'service_address': '123 Main St, Ottawa, ON K1A 0B1',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['status'], Booking.Status.REQUESTED)

        self.client.force_authenticate(user=self.owner)
        accept = self.client.post(
            f'/api/v1/bookings/{res.data["id"]}/accept/',
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(accept.status_code, 200, accept.data)
        membership = OrganizationMembership.objects.get(
            organization=org,
            user=self.customer,
            role=OrganizationMembership.Role.CUSTOMER,
        )
        self.assertEqual(
            membership.customer_status,
            OrganizationMembership.CustomerStatus.APPROVED,
        )
        self.assertEqual(
            Booking.objects.get(pk=res.data['id']).status,
            Booking.Status.CONFIRMED,
        )

    def test_service_quote_pricing_with_prefilled_answers(self):
        """Fixed org policy + quote-priced service still requires quote; answers at request."""
        org, service, slot = self._org(Organization.BookingPolicy.INSTANT)
        service.pricing_type = Service.PricingType.QUOTE
        service.quote_questions = ['How many rooms?', 'Pets on site?']
        service.save()

        self.client.force_authenticate(user=self.customer)
        create = self.client.post(
            '/api/v1/bookings/',
            {
                'slot_id': slot.id,
                'service': service.id,
                'service_address': '123 Main St, Ottawa, ON K1A 0B1',
                'quote_answers': [
                    {'id': 'q1', 'answer': '4'},
                    {'id': 'q2', 'answer': 'One dog'},
                ],
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(create.status_code, 201, create.data)
        self.assertEqual(create.data['status'], Booking.Status.REQUESTED)
        self.assertTrue(create.data['requires_quote'])
        self.assertEqual(create.data['quote_questions'][0]['answer'], '4')

        self.client.force_authenticate(user=self.owner)
        blocked = self.client.post(
            f'/api/v1/bookings/{create.data["id"]}/accept/',
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(blocked.status_code, 400)

        quoted = self.client.post(
            f'/api/v1/bookings/{create.data["id"]}/send-quote/',
            {'amount': '120.00', 'message': 'Deep clean'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(quoted.status_code, 200, quoted.data)
        self.assertEqual(quoted.data['quote_questions'][0]['answer'], '4')

        self.client.force_authenticate(user=self.customer)
        accepted = self.client.post(
            f'/api/v1/bookings/{create.data["id"]}/accept-quote/',
            {},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertEqual(accepted.data['status'], Booking.Status.CONFIRMED)

    def test_quote_policy_send_and_accept(self):
        org, service, slot = self._org(Organization.BookingPolicy.QUOTE)
        self.client.force_authenticate(user=self.customer)
        create = self.client.post(
            '/api/v1/bookings/',
            {
                'slot_id': slot.id,
                'service': service.id,
                'service_address': '123 Main St, Ottawa, ON K1A 0B1',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(create.status_code, 201, create.data)
        self.assertEqual(create.data['status'], Booking.Status.REQUESTED)
        booking_id = create.data['id']

        # Direct approve blocked for quote policy
        self.client.force_authenticate(user=self.owner)
        blocked = self.client.post(
            f'/api/v1/bookings/{booking_id}/accept/',
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)

        quoted = self.client.post(
            f'/api/v1/bookings/{booking_id}/send-quote/',
            {
                'amount': '85.50',
                'message': 'Includes supplies',
                'questions': ['How many rooms?', 'Pets on site?'],
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(quoted.status_code, 200, quoted.data)
        self.assertEqual(quoted.data['status'], Booking.Status.QUOTED)
        self.assertEqual(str(quoted.data['quote_amount']), '85.50')
        self.assertEqual(len(quoted.data['quote_questions']), 2)

        self.client.force_authenticate(user=self.customer)
        qid = quoted.data['quote_questions'][0]['id']
        accepted = self.client.post(
            f'/api/v1/bookings/{booking_id}/accept-quote/',
            {'answers': [{'id': qid, 'answer': '3 bedrooms'}]},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertEqual(accepted.data['status'], Booking.Status.CONFIRMED)
        self.assertEqual(accepted.data['quote_questions'][0]['answer'], '3 bedrooms')


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

    def test_accepting_inquiry_posts_approval_message(self):
        owner = User.objects.create_user(
            email='owner@inq-co.local', password='pass12345', full_name='Owner', phone='5550000010',
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=owner,
            role=OrganizationMembership.Role.OWNER,
        )
        self.client.force_authenticate(user=self.customer)
        create = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/service-inquiry/',
            {
                'service_id': self.service.id,
                'message': 'Need deep cleaning',
                'service_address': '123 Main St',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(create.status_code, 201)
        inquiry_id = create.data['id']

        self.client.force_authenticate(user=owner)
        accept = self.client.patch(
            f'/api/v1/organizations/{self.org.slug}/service-inquiries/{inquiry_id}/',
            {'action': 'accept'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(accept.status_code, 200)
        inquiry = CustomerServiceInquiry.objects.get(pk=inquiry_id)
        msg = ServiceRequestMessage.objects.filter(inquiry=inquiry).first()
        self.assertIsNotNone(msg)
        self.assertEqual(msg.sender_id, owner.id)
        self.assertIn('approved', msg.body.lower())
        self.assertIn('Clean', msg.body)


class RecurringScheduleSyncTests(TestCase):
    def test_sync_replaces_old_generated_open_slots_when_hours_change(self):
        org = Organization.objects.create(
            name='Recurring Co',
            slug='recurring-co',
            booking_policy=Organization.BookingPolicy.APPROVAL,
            scheduling_mode=Organization.SchedulingMode.RECURRING,
            profile_public=True,
            is_active=True,
            timezone='America/New_York',
        )
        service = Service.objects.create(
            organization=org,
            name='Wash',
            duration_minutes=60,
            base_price='25.00',
            is_active=True,
        )
        today = timezone.localdate()
        org.schedule_valid_from = today
        org.schedule_valid_until = today + timedelta(days=7)
        org.save(update_fields=['schedule_valid_from', 'schedule_valid_until'])

        weekday = today.weekday()
        WeeklyScheduleBlock.objects.create(
            organization=org,
            weekday=weekday,
            start_time='08:00',
            end_time='16:00',
            is_active=True,
        )
        sync_recurring_slots(org, weeks_ahead=1)
        first_times = list(
            AvailabilitySlot.objects.filter(organization=org, service=service)
            .values_list('start_at', flat=True)
        )
        self.assertTrue(first_times)

        WeeklyScheduleBlock.objects.filter(organization=org).delete()
        WeeklyScheduleBlock.objects.create(
            organization=org,
            weekday=weekday,
            start_time='10:00',
            end_time='12:00',
            is_active=True,
        )
        sync_recurring_slots(org, weeks_ahead=1)

        slots = list(
            AvailabilitySlot.objects.filter(organization=org, service=service)
            .order_by('start_at')
            .values_list('start_at', flat=True)
        )
        self.assertTrue(slots)
        local_hours = {timezone.localtime(dt, org.get_timezone()).hour for dt in slots}
        self.assertEqual(local_hours, {10, 11})

    def test_sync_recurring_slots_extends_expired_date_range(self):
        org = Organization.objects.create(
            name='Expired Range Co',
            slug='expired-range-co',
            scheduling_mode=Organization.SchedulingMode.RECURRING,
            profile_public=True,
            is_active=True,
            timezone='America/New_York',
        )
        service = Service.objects.create(
            organization=org,
            name='Detail',
            duration_minutes=60,
            base_price='40.00',
            is_active=True,
        )
        past = timezone.localdate() - timedelta(days=10)
        org.schedule_valid_from = past
        org.schedule_valid_until = past
        org.save(update_fields=['schedule_valid_from', 'schedule_valid_until'])

        weekday = timezone.localdate().weekday()
        WeeklyScheduleBlock.objects.create(
            organization=org,
            weekday=weekday,
            start_time='09:00',
            end_time='11:00',
            is_active=True,
        )

        created = sync_recurring_slots(org, weeks_ahead=2)
        org.refresh_from_db()

        self.assertGreater(created, 0)
        self.assertGreaterEqual(org.schedule_valid_until, timezone.localdate())
        self.assertTrue(
            AvailabilitySlot.objects.filter(
                organization=org,
                service=service,
                status=AvailabilitySlot.Status.OPEN,
                start_at__gt=timezone.now(),
            ).exists()
        )
