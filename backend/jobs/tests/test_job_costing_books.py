"""Job costing and books analytics helpers."""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from businesses.models import Organization, OrganizationMembership
from jobs.invoice_services import cost_lines_as_bill_items, issue_or_update_invoice
from jobs.job_costing_services import booking_profit_summary
from jobs.models import AvailabilitySlot, Booking, Invoice, JobCostLine, Service
from jobs.notifications import send_unpaid_invoice_followups

User = get_user_model()


@override_settings(STRIPE_SECRET_KEY='', STRIPE_ENABLED=False, SECURE_SSL_REDIRECT=False)
class JobCostingAndBooksTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='books-owner@example.com',
            full_name='Owner',
            password='pass12345',
        )
        self.customer = User.objects.create_user(
            email='books-cust@example.com',
            full_name='Customer',
            password='pass12345',
        )
        self.org = Organization.objects.create(
            name='Books Org',
            slug='books-org',
            subscription_status='active',
            invoice_followup_enabled=True,
            invoice_followup_days=[1],
        )
        OrganizationMembership.objects.create(
            user=self.owner,
            organization=self.org,
            role=OrganizationMembership.Role.OWNER,
        )
        OrganizationMembership.objects.create(
            user=self.customer,
            organization=self.org,
            role=OrganizationMembership.Role.CUSTOMER,
            customer_status=OrganizationMembership.CustomerStatus.APPROVED,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Detail',
            duration_minutes=60,
            pricing_type=Service.PricingType.FIXED,
            base_price=Decimal('200.00'),
            is_active=True,
        )
        start = timezone.now() - timedelta(days=2)
        end = start + timedelta(hours=1)
        self.slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=start,
            end_at=end,
            status=AvailabilitySlot.Status.BOOKED,
        )
        self.booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=start,
            end_at=end,
            status=Booking.Status.COMPLETED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        issue_or_update_invoice(
            self.booking,
            staff_user=self.owner,
            subtotal='200.00',
            mark_paid=False,
        )

    def test_add_cost_line_and_profit(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/costs/',
            {
                'kind': 'material',
                'description': 'Wax',
                'quantity': '2',
                'unit_cost': '10.00',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(JobCostLine.objects.filter(booking=self.booking).count(), 1)
        profit = booking_profit_summary(self.booking)
        self.assertEqual(profit['costs'], '20.00')
        self.assertEqual(Decimal(profit['revenue']), self.booking.invoice.amount)

    def test_delete_cost_line(self):
        self.client.force_authenticate(self.owner)
        created = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/costs/',
            {
                'kind': 'expense',
                'description': 'Parking',
                'quantity': '1',
                'unit_cost': '12.00',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(created.status_code, 201, created.data)
        cost_id = created.data['cost_line']['id']
        res = self.client.delete(
            f'/api/v1/bookings/{self.booking.id}/costs/{cost_id}/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['cost_lines'], [])
        self.assertEqual(res.data['profit']['costs'], '0.00')
        self.assertEqual(JobCostLine.objects.filter(booking=self.booking).count(), 0)

    def test_cannot_delete_booking_via_rest(self):
        self.client.force_authenticate(self.owner)
        res = self.client.delete(
            f'/api/v1/bookings/{self.booking.id}/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 405)
        self.assertTrue(Booking.objects.filter(pk=self.booking.id).exists())

    def test_job_extras_copy_onto_the_customer_bill(self):
        JobCostLine.objects.create(
            booking=self.booking,
            kind=JobCostLine.Kind.MATERIAL,
            description='Oil filter',
            quantity=Decimal('1'),
            unit_cost=Decimal('18.50'),
        )
        items = cost_lines_as_bill_items(self.booking)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['name'], 'Oil filter')
        self.assertEqual(items[0]['type'], 'material')
        self.assertEqual(items[0]['amount'], '18.50')

    def test_analytics_includes_ar_and_profit(self):
        JobCostLine.objects.create(
            booking=self.booking,
            kind=JobCostLine.Kind.EXPENSE,
            description='Supplies',
            quantity=Decimal('1'),
            unit_cost=Decimal('25.00'),
        )
        self.client.force_authenticate(self.owner)
        res = self.client.get(
            '/api/v1/provider-analytics/',
            {'organization': 'books-org', 'period': 'month'},
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn('ar_aging', res.data)
        self.assertIn('profit', res.data['summary'])
        self.assertEqual(res.data['ar_aging']['count'], 1)

    def test_invoice_followup_sends_after_due_day(self):
        inv = self.booking.invoice
        inv.issued_at = timezone.now() - timedelta(days=2)
        inv.payment_reminder_count = 0
        inv.save(update_fields=['issued_at', 'payment_reminder_count'])
        sent = send_unpaid_invoice_followups()
        self.assertGreaterEqual(sent, 1)
        inv.refresh_from_db()
        self.assertEqual(inv.payment_reminder_count, 1)

    def test_customer_notes(self):
        self.client.force_authenticate(self.owner)
        res = self.client.patch(
            f'/api/v1/organizations/books-org/customers/{self.customer.id}/',
            {'provider_notes': 'Prefers mornings'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['provider_notes'], 'Prefers mornings')
