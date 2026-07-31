"""Stripe billing endpoints when keys are missing / basic auth."""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from businesses.models import Organization, OrganizationMembership
from jobs.invoice_services import issue_or_update_invoice
from jobs.models import (
    AvailabilitySlot,
    Booking,
    CustomerNotification,
    Invoice,
    ProviderNotification,
    Service,
)
from jobs.stripe_services import mark_invoice_paid_from_stripe

User = get_user_model()


@override_settings(STRIPE_SECRET_KEY='', STRIPE_ENABLED=False)
class StripeNotConfiguredTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='stripe-owner@example.com',
            full_name='Owner',
            password='pass12345',
        )
        self.customer = User.objects.create_user(
            email='stripe-cust@example.com',
            full_name='Customer',
            password='pass12345',
        )
        self.org = Organization.objects.create(
            name='Stripe Org',
            slug='stripe-org',
            service_city='Toronto',
            service_state='ON',
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
            name='Clean',
            duration_minutes=60,
            pricing_type=Service.PricingType.FIXED,
            base_price=Decimal('100.00'),
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
            status=Booking.Status.COMPLETED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        issue_or_update_invoice(
            self.booking,
            staff_user=self.owner,
            subtotal='100.00',
            mark_paid=False,
        )

    def test_billing_summary_without_stripe(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/v1/organizations/stripe-org/billing/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['stripe_configured'])
        self.assertEqual(res.data['platform_fee_cents'], 70)

    def test_connect_onboard_requires_stripe(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            '/api/v1/organizations/stripe-org/billing/connect/onboard/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('code'), 'stripe_not_configured')

    def test_pay_invoice_requires_stripe(self):
        self.client.force_authenticate(self.customer)
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/invoice/pay/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('code'), 'stripe_not_configured')

    def test_invoice_serializer_can_pay_online_false(self):
        self.client.force_authenticate(self.customer)
        res = self.client.get(
            f'/api/v1/bookings/{self.booking.id}/invoice/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data.get('can_pay_online'))
        self.assertEqual(res.data.get('status'), Invoice.Status.ISSUED)

    def test_issuing_invoice_creates_customer_payment_notification(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/invoice/',
            {'subtotal': '100.00', 'mark_paid': False},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(CustomerNotification.objects.filter(
            customer=self.customer,
            booking=self.booking,
            kind=CustomerNotification.Kind.INVOICE_READY,
        ).exists())

    @override_settings(STRIPE_SECRET_KEY='sk_test_fake', STRIPE_ENABLED=True)
    def test_customer_unpaid_invoice_prompt_payload(self):
        self.org.stripe_account_id = 'acct_test'
        self.org.stripe_charges_enabled = True
        self.org.save(update_fields=['stripe_account_id', 'stripe_charges_enabled'])
        self.client.force_authenticate(self.customer)
        res = self.client.get('/api/v1/me/unpaid-invoice/', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['booking_id'], self.booking.id)
        self.assertEqual(res.data['invoice']['status'], Invoice.Status.ISSUED)
        self.assertTrue(res.data['invoice']['can_pay_online'])

    def test_stripe_payment_notifies_customer_and_provider(self):
        invoice = self.booking.invoice
        mark_invoice_paid_from_stripe(
            invoice=invoice,
            payment_intent_id='pi_test',
            session_id='cs_test',
        )
        self.assertTrue(CustomerNotification.objects.filter(
            customer=self.customer,
            booking=self.booking,
            kind=CustomerNotification.Kind.PAYMENT_CONFIRMED,
        ).exists())
        self.assertTrue(ProviderNotification.objects.filter(
            organization=self.org,
            kind=ProviderNotification.Kind.PAYMENT_RECEIVED,
        ).exists())
