from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import AvailabilitySlot, Booking, Invoice, Service, ServiceRequestMessage


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
                'service_address': '1 Test Street',
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
        msg = ServiceRequestMessage.objects.filter(booking=booking).first()
        self.assertIsNotNone(msg)
        self.assertEqual(msg.sender_id, self.provider.id)
        self.assertIn('approved', msg.body.lower())
        self.assertIn('Oil change', msg.body)

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
        self.assertTrue(hasattr(booking, 'invoice') or Invoice.objects.filter(booking=booking).exists())

    def test_customer_reschedule_confirmed_booking(self):
        new_start = timezone.now() + timedelta(days=3)
        new_end = new_start + timedelta(hours=1)
        new_slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=new_start,
            end_at=new_end,
            status=AvailabilitySlot.Status.OPEN,
        )
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
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/reschedule/',
            {'slot_id': new_slot.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        booking.refresh_from_db()
        self.slot.refresh_from_db()
        new_slot.refresh_from_db()
        self.assertEqual(booking.availability_slot_id, new_slot.id)
        self.assertEqual(booking.start_at, new_slot.start_at)
        self.assertEqual(booking.status, Booking.Status.REQUESTED)
        self.assertEqual(self.slot.status, AvailabilitySlot.Status.OPEN)
        self.assertEqual(new_slot.status, AvailabilitySlot.Status.PENDING)

    def test_customer_reschedule_unconfirmed_booking(self):
        new_start = timezone.now() + timedelta(days=4)
        new_end = new_start + timedelta(hours=1)
        new_slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=new_start,
            end_at=new_end,
            status=AvailabilitySlot.Status.OPEN,
        )
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
        self.slot.save()

        self._auth(self.customer)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/reschedule/',
            {'slot_id': new_slot.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.REQUESTED)
        self.assertEqual(booking.availability_slot_id, new_slot.id)
        self.slot.refresh_from_db()
        new_slot.refresh_from_db()
        self.assertEqual(self.slot.status, AvailabilitySlot.Status.OPEN)
        self.assertEqual(new_slot.status, AvailabilitySlot.Status.PENDING)

    def test_customer_reschedule_on_instant_org_still_needs_approval(self):
        self.org.booking_policy = Organization.BookingPolicy.INSTANT
        self.org.save()
        new_start = timezone.now() + timedelta(days=5)
        new_end = new_start + timedelta(hours=1)
        new_slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=new_start,
            end_at=new_end,
            status=AvailabilitySlot.Status.OPEN,
        )
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
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/reschedule/',
            {'slot_id': new_slot.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        booking.refresh_from_db()
        new_slot.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.REQUESTED)
        self.assertEqual(new_slot.status, AvailabilitySlot.Status.PENDING)

    def test_provider_reschedule_on_instant_org_stays_confirmed(self):
        self.org.booking_policy = Organization.BookingPolicy.INSTANT
        self.org.save()
        new_start = timezone.now() + timedelta(days=6)
        new_end = new_start + timedelta(hours=1)
        new_slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=new_start,
            end_at=new_end,
            status=AvailabilitySlot.Status.OPEN,
        )
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

        self._auth(self.provider)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/reschedule/',
            {'slot_id': new_slot.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        booking.refresh_from_db()
        new_slot.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(new_slot.status, AvailabilitySlot.Status.BOOKED)

    def test_provider_reschedule_on_approval_org_stays_confirmed(self):
        self.org.booking_policy = Organization.BookingPolicy.APPROVAL
        self.org.save()
        new_start = timezone.now() + timedelta(days=7)
        new_end = new_start + timedelta(hours=1)
        new_slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=new_start,
            end_at=new_end,
            status=AvailabilitySlot.Status.OPEN,
        )
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
        self.slot.save()

        self._auth(self.provider)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/reschedule/',
            {'slot_id': new_slot.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        booking.refresh_from_db()
        new_slot.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(new_slot.status, AvailabilitySlot.Status.BOOKED)

    def test_provider_incomplete_schedule_later(self):
        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=self.slot.start_at,
            end_at=self.slot.end_at,
            status=Booking.Status.IN_PROGRESS,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        self.slot.status = AvailabilitySlot.Status.BOOKED
        self.slot.save()

        self._auth(self.provider)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/incomplete/',
            {'note': 'Waiting on a part'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.NEEDS_RETURN)
        msg = ServiceRequestMessage.objects.filter(booking=booking).order_by('-id').first()
        self.assertIsNotNone(msg)
        self.assertIn('could not be finished', msg.body.lower())
        self.assertIn('Waiting on a part', msg.body)

    def test_provider_incomplete_with_return_visit_slot(self):
        return_start = timezone.now() + timedelta(days=5)
        return_end = return_start + timedelta(hours=1)
        return_slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=return_start,
            end_at=return_end,
            status=AvailabilitySlot.Status.OPEN,
        )
        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=self.slot.start_at,
            end_at=self.slot.end_at,
            status=Booking.Status.IN_PROGRESS,
            source=Booking.Source.CUSTOMER_REQUEST,
            service_address='123 Main St',
        )
        self.slot.status = AvailabilitySlot.Status.BOOKED
        self.slot.save()

        self._auth(self.provider)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/incomplete/',
            {'slot_id': return_slot.id, 'note': 'Finish install'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn('return_booking', res.data)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.NEEDS_RETURN)
        child = Booking.objects.get(pk=res.data['return_booking']['id'])
        self.assertEqual(child.parent_booking_id, booking.id)
        self.assertEqual(child.status, Booking.Status.CONFIRMED)
        self.assertEqual(child.service_address, '123 Main St')
        return_slot.refresh_from_db()
        self.assertEqual(return_slot.status, AvailabilitySlot.Status.BOOKED)
        msg = ServiceRequestMessage.objects.filter(booking=booking).order_by('-id').first()
        self.assertIsNotNone(msg)
        self.assertIn('return visit is scheduled', msg.body.lower())

    def test_schedule_return_visit_from_needs_return(self):
        return_start = timezone.now() + timedelta(days=6)
        return_end = return_start + timedelta(hours=1)
        return_slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=return_start,
            end_at=return_end,
            status=AvailabilitySlot.Status.OPEN,
        )
        booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=self.slot.start_at,
            end_at=self.slot.end_at,
            status=Booking.Status.NEEDS_RETURN,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        self._auth(self.provider)
        res = self.client.post(
            f'/api/v1/bookings/{booking.id}/return-visit/',
            {'slot_id': return_slot.id},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        child = Booking.objects.get(pk=res.data['return_booking']['id'])
        self.assertEqual(child.parent_booking_id, booking.id)
        self.assertEqual(child.status, Booking.Status.CONFIRMED)

    def test_customer_batch_book_two_services(self):
        oil = Service.objects.create(
            organization=self.org,
            name='Oil change',
            duration_minutes=30,
            base_price='40.00',
            is_active=True,
        )
        tyre = Service.objects.create(
            organization=self.org,
            name='Tyre change',
            duration_minutes=45,
            base_price='60.00',
            is_active=True,
        )
        start = timezone.now() + timedelta(days=3)
        slot_a = AvailabilitySlot.objects.create(
            organization=self.org,
            service=oil,
            start_at=start,
            end_at=start + timedelta(minutes=30),
            status=AvailabilitySlot.Status.OPEN,
        )
        slot_b = AvailabilitySlot.objects.create(
            organization=self.org,
            service=tyre,
            start_at=start + timedelta(hours=1),
            end_at=start + timedelta(hours=1, minutes=45),
            status=AvailabilitySlot.Status.OPEN,
        )
        self._auth(self.customer)
        res = self.client.post(
            '/api/v1/bookings/batch/',
            {
                'service_address': 'K1A0B1 Ottawa ON',
                'customer_notes': 'Please call on arrival',
                'bookings': [
                    {'slot_id': slot_a.id, 'service': oil.id},
                    {'slot_id': slot_b.id, 'service': tyre.id},
                ],
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(len(res.data), 2)
        names = sorted(b['service_name'] for b in res.data)
        self.assertEqual(names, ['Oil change', 'Tyre change'])
        slot_a.refresh_from_db()
        slot_b.refresh_from_db()
        self.assertEqual(slot_a.status, AvailabilitySlot.Status.PENDING)
        self.assertEqual(slot_b.status, AvailabilitySlot.Status.PENDING)

    def test_concurrent_capacity_allows_two_bookings_same_slot(self):
        self.org.concurrent_capacity = 2
        self.org.booking_policy = Organization.BookingPolicy.INSTANT
        self.org.save(update_fields=['concurrent_capacity', 'booking_policy'])
        customer2 = User.objects.create_user(
            email='customer2@test.local',
            password='password123',
            full_name='Customer Two',
            phone='5550000003',
        )

        self._auth(self.customer)
        res1 = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': self.slot.id, 'service_address': '1 Main St'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res1.status_code, 201, res1.data)
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.status, AvailabilitySlot.Status.OPEN)
        self.assertEqual(self.slot.remaining_capacity(), 1)

        self._auth(customer2)
        res2 = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': self.slot.id, 'service_address': '2 Main St'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res2.status_code, 201, res2.data)
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.status, AvailabilitySlot.Status.BOOKED)
        self.assertEqual(self.slot.remaining_capacity(), 0)

        customer3 = User.objects.create_user(
            email='customer3@test.local',
            password='password123',
            full_name='Customer Three',
            phone='5550000004',
        )
        self._auth(customer3)
        res3 = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': self.slot.id, 'service_address': '3 Main St'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res3.status_code, 400)

    def test_owner_can_update_concurrent_capacity(self):
        self._auth(self.provider)
        res = self.client.patch(
            f'/api/v1/organizations/{self.org.slug}/',
            {'concurrent_capacity': 3},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.concurrent_capacity, 3)

    def test_default_capacity_rejects_second_simultaneous_booking(self):
        """Default concurrent_capacity is 1 — second booking on the same slot fails."""
        self.assertEqual(self.org.concurrent_capacity, 1)
        self.org.booking_policy = Organization.BookingPolicy.INSTANT
        self.org.save(update_fields=['booking_policy'])
        customer2 = User.objects.create_user(
            email='customer2-default@test.local',
            password='password123',
            full_name='Customer Two',
            phone='5550000005',
        )

        self._auth(self.customer)
        res1 = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': self.slot.id, 'service_address': '1 Main St'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res1.status_code, 201, res1.data)
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.remaining_capacity(), 0)
        self.assertFalse(self.slot.is_bookable())

        self._auth(customer2)
        res2 = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': self.slot.id, 'service_address': '2 Main St'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res2.status_code, 400)

    def test_cancel_frees_capacity_seat_when_concurrent(self):
        """Canceling one of two occupying bookings frees a seat; slot stays bookable."""
        self.org.concurrent_capacity = 2
        self.org.booking_policy = Organization.BookingPolicy.INSTANT
        self.org.save(update_fields=['concurrent_capacity', 'booking_policy'])
        customer2 = User.objects.create_user(
            email='customer2-cancel@test.local',
            password='password123',
            full_name='Customer Two',
            phone='5550000006',
        )

        self._auth(self.customer)
        res1 = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': self.slot.id, 'service_address': '1 Main St'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res1.status_code, 201, res1.data)
        booking1_id = res1.data['id']

        self._auth(customer2)
        res2 = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': self.slot.id, 'service_address': '2 Main St'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res2.status_code, 201, res2.data)
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.remaining_capacity(), 0)

        self._auth(self.customer)
        cancel = self.client.post(
            f'/api/v1/bookings/{booking1_id}/cancel/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(cancel.status_code, 200, cancel.data)
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.remaining_capacity(), 1)
        self.assertTrue(self.slot.is_bookable())
        self.assertEqual(self.slot.status, AvailabilitySlot.Status.OPEN)

        customer3 = User.objects.create_user(
            email='customer3-cancel@test.local',
            password='password123',
            full_name='Customer Three',
            phone='5550000007',
        )
        self._auth(customer3)
        res3 = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': self.slot.id, 'service_address': '3 Main St'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res3.status_code, 201, res3.data)

    def test_customer_calendar_available_when_one_of_two_seats_filled(self):
        """Public calendar keeps the slot available while remaining_capacity > 0."""
        self.org.concurrent_capacity = 2
        self.org.booking_policy = Organization.BookingPolicy.INSTANT
        self.org.save(update_fields=['concurrent_capacity', 'booking_policy'])

        Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=self.slot.start_at,
            end_at=self.slot.end_at,
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        self.slot.refresh_status(save=True)
        self.assertEqual(self.slot.status, AvailabilitySlot.Status.OPEN)
        self.assertEqual(self.slot.remaining_capacity(), 1)

        self._auth(self.customer)
        local_start = timezone.localtime(self.slot.start_at)
        res = self.client.get(
            f'/api/v1/public/providers/{self.org.slug}/services/{self.service.id}/calendar/',
            {'year': local_start.year, 'month': local_start.month},
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        found = None
        for slots in (res.data.get('slots_by_day') or {}).values():
            for s in slots:
                if s['id'] == self.slot.id:
                    found = s
                    break
        self.assertIsNotNone(found)
        self.assertTrue(found['available'])
        self.assertEqual(found['capacity'], 2)
        self.assertEqual(found['occupied_count'], 1)
        self.assertEqual(found['remaining_capacity'], 1)
