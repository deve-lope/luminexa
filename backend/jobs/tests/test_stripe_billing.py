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


@override_settings(STRIPE_SECRET_KEY='', STRIPE_ENABLED=False, SECURE_SSL_REDIRECT=False)
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
        self.assertEqual(res.data['platform_fee_percent'], 0.5)
        self.assertIn('payouts', res.data)
        self.assertIn('quickbooks', res.data)
        self.assertFalse(res.data['quickbooks']['enabled'])

    def test_instant_payout_requires_stripe(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            '/api/v1/organizations/stripe-org/billing/instant-payout/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('code'), 'stripe_not_configured')

    def test_quickbooks_connect_requires_config(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            '/api/v1/organizations/stripe-org/accounting/quickbooks/connect/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('code'), 'quickbooks_not_configured')
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


@override_settings(
    STRIPE_SECRET_KEY='sk_test_fake',
    STRIPE_ENABLED=True,
    STRIPE_WEBHOOK_SECRET='',
    DEBUG=False,
)
class StripeWebhookSecurityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_unsigned_webhook_rejected_when_not_debug(self):
        res = self.client.post(
            '/api/v1/webhooks/stripe/',
            data='{"id":"evt_x","type":"checkout.session.completed","data":{"object":{}}}',
            content_type='application/json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 503)
        self.assertEqual(res.data.get('code'), 'webhook_secret_required')


@override_settings(STRIPE_SECRET_KEY='sk_test_fake', STRIPE_ENABLED=True, DEBUG=True)
class StripeWebhookDebugUnsignedTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='wh-owner@example.com',
            full_name='Owner',
            password='pass12345',
        )
        self.customer = User.objects.create_user(
            email='wh-cust@example.com',
            full_name='Customer',
            password='pass12345',
        )
        self.org = Organization.objects.create(
            name='Webhook Org',
            slug='webhook-org',
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
            name='Wash',
            duration_minutes=60,
            pricing_type=Service.PricingType.FIXED,
            base_price=Decimal('50.00'),
            is_active=True,
        )
        start = timezone.now() + timedelta(hours=3)
        end = start + timedelta(hours=1)
        self.booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start,
            end_at=end,
            status=Booking.Status.COMPLETED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )
        issue_or_update_invoice(
            self.booking,
            staff_user=self.owner,
            subtotal='50.00',
            mark_paid=False,
        )

    def test_unpaid_checkout_session_does_not_mark_invoice_paid(self):
        from jobs.stripe_views import _on_checkout_completed

        invoice = self.booking.invoice
        _on_checkout_completed({
            'id': 'cs_test_unpaid',
            'mode': 'payment',
            'payment_status': 'unpaid',
            'payment_intent': 'pi_test',
            'metadata': {
                'kind': 'invoice_payment',
                'invoice_id': str(invoice.id),
            },
        })
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, Invoice.Status.ISSUED)


@override_settings(STRIPE_SECRET_KEY='sk_test_fake', STRIPE_ENABLED=True)
class ProviderSubscriptionGateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='sub-owner@example.com',
            full_name='Owner',
            password='pass12345',
        )
        self.org = Organization.objects.create(
            name='Sub Org',
            slug='sub-org',
            subscription_status='none',
        )
        OrganizationMembership.objects.create(
            user=self.owner,
            organization=self.org,
            role=OrganizationMembership.Role.OWNER,
        )

    def test_create_service_blocked_without_subscription(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            '/api/v1/services/',
            {
                'organization': self.org.id,
                'name': 'Blocked Service',
                'duration_minutes': 60,
                'pricing_type': 'fixed',
                'base_price': '10.00',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data.get('code'), 'subscription_required')

    def test_create_service_allowed_when_trialing(self):
        self.org.subscription_status = 'trialing'
        self.org.save(update_fields=['subscription_status'])
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            '/api/v1/services/',
            {
                'organization': self.org.id,
                'name': 'Allowed Service',
                'duration_minutes': 60,
                'pricing_type': 'fixed',
                'base_price': '10.00',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)

    def test_invite_staff_blocked_without_subscription(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            '/api/v1/organizations/sub-org/invite-staff/',
            {'email': 'newstaff@example.com'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data.get('code'), 'subscription_required')

    def test_customers_list_blocked_without_subscription(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get(
            '/api/v1/organizations/sub-org/customers/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data.get('code'), 'subscription_required')


class PlatformFeePercentTests(TestCase):
    def test_half_percent_of_hundred_dollars(self):
        from jobs.stripe_services import platform_fee_cents_for_amount

        # $100.00 → 0.5% = $0.50
        self.assertEqual(platform_fee_cents_for_amount(10000), 50)

    def test_rounds_half_up(self):
        from jobs.stripe_services import platform_fee_cents_for_amount

        # $10.00 → 5 cents; $1.00 → 1 cent (0.5 rounds up)
        self.assertEqual(platform_fee_cents_for_amount(1000), 5)
        self.assertEqual(platform_fee_cents_for_amount(100), 1)

    def test_never_meets_or_exceeds_amount(self):
        from jobs.stripe_services import platform_fee_cents_for_amount

        self.assertEqual(platform_fee_cents_for_amount(1), 0)
        self.assertLess(platform_fee_cents_for_amount(2), 2)
