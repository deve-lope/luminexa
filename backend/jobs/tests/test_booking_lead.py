from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from businesses.models import Organization, OrganizationMembership
from jobs.booking_lead import earliest_customer_bookable_at
from jobs.models import AvailabilitySlot, Booking, Service

User = get_user_model()


@override_settings(CUSTOMER_BOOKING_LEAD_HOURS=2)
class BookingLeadTimeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.provider = User.objects.create_user(
            email='lead-provider@test.local', password='password123', full_name='Provider',
        )
        self.customer = User.objects.create_user(
            email='lead-customer@test.local', password='password123', full_name='Customer',
            phone='5551112222',
        )
        self.org = Organization.objects.create(
            name='Lead Co',
            slug='lead-co',
            booking_policy=Organization.BookingPolicy.INSTANT,
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
            name='Quick wash',
            duration_minutes=60,
            base_price=Decimal('40.00'),
            is_active=True,
        )

    def _slot(self, *, hours_from_now, status=AvailabilitySlot.Status.OPEN):
        start = timezone.now() + timedelta(hours=hours_from_now)
        end = start + timedelta(hours=1)
        return AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=start,
            end_at=end,
            status=status,
        )

    def test_rejects_past_slot(self):
        slot = self._slot(hours_from_now=-1)
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': slot.id, 'customer_notes': 'Need a wash today please'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('over', str(res.data).lower())

    def test_rejects_slot_inside_two_hour_buffer(self):
        slot = self._slot(hours_from_now=1)
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            '/api/v1/bookings/',
            {'slot_id': slot.id, 'customer_notes': 'Need a wash today please'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('2 hours', str(res.data).lower())

    def test_allows_slot_beyond_two_hour_buffer(self):
        slot = self._slot(hours_from_now=3)
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            '/api/v1/bookings/',
            {
                'slot_id': slot.id,
                'customer_notes': 'Need a wash today please',
                'service_address': '123 Main St Ottawa ON K1Z 5G6',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['status'], 'confirmed')

    def test_calendar_marks_near_slots_unavailable(self):
        soon = self._slot(hours_from_now=1)
        later = self._slot(hours_from_now=5)
        self.client.force_authenticate(self.customer)
        now = timezone.now()
        res = self.client.get(
            f'/api/v1/public/providers/{self.org.slug}/services/{self.service.id}/calendar/',
            {'year': now.year, 'month': now.month},
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        found = {}
        for slots in (res.data.get('slots_by_day') or {}).values():
            for s in slots:
                found[s['id']] = s['available']
        self.assertFalse(found.get(soon.id, True))
        self.assertTrue(found.get(later.id, False))
        self.assertGreaterEqual(later.start_at, earliest_customer_bookable_at())
