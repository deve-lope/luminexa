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
from jobs.tax_rates import calculate_tax, calculate_tax_for_organization

User = get_user_model()


class TaxRateTests(TestCase):
    def test_ontario_hst_federal_and_provincial_combined(self):
        result = calculate_tax(subtotal=Decimal('100.00'), country='CA', region='ON')
        self.assertEqual(result['tax_total'], Decimal('13.00'))
        self.assertEqual(result['total'], Decimal('113.00'))
        self.assertEqual(len(result['tax_lines']), 1)
        self.assertEqual(result['tax_lines'][0]['code'], 'HST')

    def test_bc_gst_and_pst(self):
        result = calculate_tax(subtotal=Decimal('100.00'), country='CA', region='BC')
        codes = [line['code'] for line in result['tax_lines']]
        self.assertEqual(codes, ['GST', 'PST'])
        self.assertEqual(result['tax_total'], Decimal('12.00'))
        self.assertEqual(result['total'], Decimal('112.00'))

    def test_us_state_sales_tax_no_federal(self):
        result = calculate_tax(subtotal=Decimal('100.00'), country='US', region='NY')
        self.assertEqual(len(result['tax_lines']), 1)
        self.assertEqual(result['tax_lines'][0]['code'], 'STATE')
        self.assertEqual(result['tax_total'], Decimal('4.00'))
        self.assertEqual(result['currency'], 'USD')


class InvoiceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-inv@luminexa.local', password='password123', full_name='Owner',
        )
        self.customer = User.objects.create_user(
            email='cust-inv@luminexa.local', password='password123', full_name='Customer',
        )
        self.org = Organization.objects.create(
            name='Invoice Org',
            slug='invoice-org',
            service_city='Toronto',
            service_state='ON',
        )
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

    def test_complete_creates_invoice_with_tax_from_business_address(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/complete/',
            {'subtotal': '75.50', 'notes': 'Extra bagging', 'mark_paid': True},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], 'completed')
        inv = res.data.get('invoice')
        self.assertIsNotNone(inv)
        self.assertEqual(inv['number'], f'INV-{self.booking.id:05d}')
        self.assertEqual(Decimal(inv['subtotal']), Decimal('75.50'))
        # ON HST 13%
        self.assertEqual(Decimal(inv['tax_total']), Decimal('9.82'))
        self.assertEqual(Decimal(inv['amount']), Decimal('85.32'))
        self.assertEqual(inv['tax_country'], 'CA')
        self.assertEqual(inv['tax_region'], 'ON')
        self.assertEqual(inv['status'], 'paid')
        self.assertEqual(inv['notes'], 'Extra bagging')
        self.assertEqual(inv['pricing_type'], 'range')
        self.assertTrue(any(line['code'] == 'HST' for line in inv['tax_lines']))

    def test_customer_can_download_invoice_pdf(self):
        issue_or_update_invoice(
            self.booking,
            staff_user=self.owner,
            subtotal='80.00',
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
        self.assertIn(b'Subtotal', res.content)
        self.assertIn(b'HST', res.content)

    def test_booking_list_includes_invoice_for_customer(self):
        issue_or_update_invoice(
            self.booking,
            staff_user=self.owner,
            subtotal='70.00',
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
            self.booking, staff_user=self.owner, subtotal='65.00',
        )
        pdf = build_invoice_pdf(inv)
        self.assertTrue(pdf.startswith(b'%PDF'))
        self.assertIn(inv.number.encode(), pdf)

    def test_complete_with_line_items_adds_to_subtotal(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/complete/',
            {
                'service_fee': '50.00',
                'line_items': [
                    {
                        'name': 'Oil change',
                        'type': 'oil',
                        'brand': 'Castrol',
                        'quantity': 3,
                        'amount': '100.00',
                    },
                    {
                        'name': 'Oil filter',
                        'type': '',
                        'brand': 'Castrol',
                        'quantity': 1,
                        'amount': '25.00',
                    },
                ],
                'mark_paid': True,
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        inv = res.data.get('invoice')
        self.assertIsNotNone(inv)
        # 50 + 100 + 25 = 175 pre-tax; ON HST 13% → 22.75; total 197.75
        self.assertEqual(Decimal(inv['subtotal']), Decimal('175.00'))
        self.assertEqual(Decimal(inv['tax_total']), Decimal('22.75'))
        self.assertEqual(Decimal(inv['amount']), Decimal('197.75'))
        self.assertEqual(len(inv['line_items']), 2)
        self.assertEqual(inv['line_items'][0]['name'], 'Oil change')
        self.assertEqual(inv['line_items'][0]['brand'], 'Castrol')
        self.assertEqual(inv['line_items'][0]['amount'], '100.00')
        pdf = build_invoice_pdf(self.booking.invoice)
        self.assertIn(b'Oil change', pdf)
        self.assertIn(b'Castrol', pdf)

    def test_us_business_address_uses_state_tax(self):
        self.org.service_state = 'NY'
        self.org.service_city = 'New York'
        self.org.save(update_fields=['service_state', 'service_city'])
        tax = calculate_tax_for_organization(self.org, Decimal('100.00'))
        self.assertEqual(tax['tax_country'], 'US')
        self.assertEqual(tax['currency'], 'USD')
        self.assertEqual(tax['tax_total'], Decimal('4.00'))
        inv = issue_or_update_invoice(
            self.booking, staff_user=self.owner, subtotal='100.00',
        )
        self.assertEqual(inv.currency, 'USD')
        self.assertEqual(inv.tax_region, 'NY')
        self.assertEqual(inv.amount, Decimal('104.00'))
