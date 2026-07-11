from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from businesses.models import Organization, OrganizationMembership
from jobs.invoice_services import issue_or_update_invoice, mark_invoice_paid
from jobs.models import AvailabilitySlot, Booking, Invoice, Service, ServiceReview

User = get_user_model()


class ProviderAnalyticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-analytics@luminexa.local',
            password='password123',
            full_name='Owner',
        )
        self.customer = User.objects.create_user(
            email='cust-analytics@luminexa.local',
            password='password123',
            full_name='Customer One',
        )
        self.customer2 = User.objects.create_user(
            email='cust2-analytics@luminexa.local',
            password='password123',
            full_name='Customer Two',
        )
        self.org = Organization.objects.create(
            name='Analytics Org',
            slug='analytics-org',
            service_city='Toronto',
            service_state='ON',
            timezone='America/Toronto',
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='House cleaning',
            duration_minutes=120,
            pricing_type=Service.PricingType.FIXED,
            base_price=Decimal('100.00'),
            is_active=True,
        )
        now = timezone.now()
        self.booking1 = self._make_booking(
            self.customer, now - timedelta(days=2), hours=2, status=Booking.Status.COMPLETED,
        )
        self.booking2 = self._make_booking(
            self.customer, now - timedelta(days=1), hours=1, status=Booking.Status.COMPLETED,
        )
        self.booking3 = self._make_booking(
            self.customer2, now - timedelta(hours=5), hours=1, status=Booking.Status.COMPLETED,
        )
        inv1 = issue_or_update_invoice(
            self.booking1, staff_user=self.owner, subtotal='100.00', mark_paid=True,
        )
        inv2 = issue_or_update_invoice(
            self.booking2, staff_user=self.owner, subtotal='80.00', mark_paid=True,
        )
        issue_or_update_invoice(
            self.booking3, staff_user=self.owner, subtotal='50.00', mark_paid=False,
        )
        # Ensure paid_at is set for income windowing
        for inv in (inv1, inv2):
            if inv.status != Invoice.Status.PAID:
                mark_invoice_paid(inv, staff_user=self.owner)
        ServiceReview.objects.create(
            service=self.service,
            customer=self.customer,
            booking=self.booking1,
            communication=5,
            price=4,
            punctual=5,
            quality=5,
        )

    def _make_booking(self, customer, start, hours=1, status=Booking.Status.COMPLETED):
        end = start + timedelta(hours=hours)
        slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=start,
            end_at=end,
            status=AvailabilitySlot.Status.BOOKED,
        )
        return Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=customer,
            availability_slot=slot,
            start_at=start,
            end_at=end,
            status=status,
            source=Booking.Source.CUSTOMER_REQUEST,
        )

    def test_requires_org_and_staff(self):
        res = self.client.get('/api/v1/provider-analytics/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 401)

        self.client.force_authenticate(self.customer)
        res = self.client.get(
            '/api/v1/provider-analytics/',
            {'organization': 'analytics-org'},
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 403)

    def test_month_summary(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get(
            '/api/v1/provider-analytics/',
            {'organization': 'analytics-org', 'period': 'month'},
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        summary = res.data['summary']
        self.assertEqual(summary['gigs_completed'], 3)
        self.assertEqual(summary['unique_customers'], 2)
        self.assertEqual(summary['recurring_customers'], 1)  # customer has 2 gigs
        self.assertEqual(summary['hours_spent'], 4.0)
        self.assertGreater(Decimal(summary['income_collected']), Decimal('0'))
        self.assertGreater(Decimal(summary['income_outstanding']), Decimal('0'))
        self.assertEqual(summary['review_count'], 1)
        self.assertIsNotNone(summary['avg_rating'])
        self.assertEqual(res.data['totals']['gigs_completed'], 3)
        self.assertTrue(len(res.data['series']) >= 1)
        self.assertEqual(res.data['by_service'][0]['service_name'], 'House cleaning')
        self.assertEqual(res.data['top_customers'][0]['gigs'], 2)

    def test_all_period(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get(
            '/api/v1/provider-analytics/',
            {'organization': 'analytics-org', 'period': 'all'},
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data['range']['start'])
        self.assertIsNone(res.data['previous'])
