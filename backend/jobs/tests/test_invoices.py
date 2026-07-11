from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from businesses.models import Organization, OrganizationMembership
from jobs.invoice_pdf import build_invoice_pdf
from jobs.invoice_services import issue_or_update_invoice
from jobs.models import AvailabilitySlot, Booking, Service

User = get_user_model()


class InvoiceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-inv@luminexa.local', password='password123', full_name='Owner',
        )
        self.customer = User.objects.create_user(
            email='cust-inv@luminexa.local', password='password123', full_name='Customer',
        )
        self.org = Organization.objects.create(name='Invoice Org', slug='invoice-org')
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Lawn care',
            duration_minutes=60,
            pricing_type=Service.PricingType.RANGE,
            base_price=Decimal('60.00'),
            price_max=Decimal('90.00'),
            is_active=True,
        )
        start = timezone.now() + timedelta(hours=2)
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
            status=Booking.Status.IN_PROGRESS,
            source=Booking.Source.CUSTOMER_REQUEST,
        )

    def test_complete_creates_invoice_with_final_amount(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/complete/',
            {'amount': '75.50', 'notes': 'Extra bagging', 'mark_paid': True},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], 'completed')
        inv = res.data.get('invoice')
        self.assertIsNotNone(inv)
        self.assertEqual(inv['number'], f'INV-{self.booking.id:05d}')
        self.assertEqual(Decimal(inv['amount']), Decimal('75.50'))
        self.assertEqual(inv['status'], 'paid')
        self.assertEqual(inv['notes'], 'Extra bagging')
        self.assertEqual(inv['pricing_type'], 'range')

    def test_customer_can_download_invoice_pdf(self):
        issue_or_update_invoice(
            self.booking,
            staff_user=self.owner,
            amount='80.00',
            notes='Done',
        )
        self.booking.status = Booking.Status.COMPLETED
        self.booking.save(update_fields=['status', 'updated_at'])

        self.client.force_authenticate(self.customer)
        res = self.client.get(
            f'/api/v1/bookings/{self.booking.id}/invoice/download/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'application/pdf')
        self.assertTrue(res.content.startswith(b'%PDF'))
        self.assertIn(b'INVOICE', res.content)

    def test_booking_list_includes_invoice_for_customer(self):
        issue_or_update_invoice(
            self.booking,
            staff_user=self.owner,
            amount='70.00',
        )
        self.booking.status = Booking.Status.COMPLETED
        self.booking.save(update_fields=['status', 'updated_at'])

        self.client.force_authenticate(self.customer)
        res = self.client.get('/api/v1/bookings/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
        rows = res.data if isinstance(res.data, list) else res.data.get('results', [])
        match = next(r for r in rows if r['id'] == self.booking.id)
        self.assertIsNotNone(match.get('invoice'))
        self.assertEqual(match['invoice']['number'], f'INV-{self.booking.id:05d}')

    def test_pdf_builder_bytes(self):
        inv = issue_or_update_invoice(
            self.booking, staff_user=self.owner, amount='65.00',
        )
        pdf = build_invoice_pdf(inv)
        self.assertTrue(pdf.startswith(b'%PDF'))
        self.assertIn(inv.number.encode(), pdf)
