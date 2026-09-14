from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from businesses.models import Organization, OrganizationMembership
from jobs.booking_services import complete_booking
from jobs.invoice_services import issue_or_update_invoice
from jobs.models import AvailabilitySlot, Booking, Referral, ReferralCoupon, Service
from jobs.referral_services import (
    attach_referral_attribution,
    get_or_create_referral_code,
    program_is_active,
)

User = get_user_model()


class ReferralRewardsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-ref@luminexa.local', password='password123', full_name='Owner',
        )
        self.referrer = User.objects.create_user(
            email='referrer@luminexa.local', password='password123', full_name='Referrer',
            phone='+15551110001',
        )
        self.referred = User.objects.create_user(
            email='referred@luminexa.local', password='password123', full_name='Referred',
            phone='+15551110002',
        )
        self.org = Organization.objects.create(
            name='Referral Org',
            slug='referral-org',
            service_city='Toronto',
            service_state='ON',
            booking_policy=Organization.BookingPolicy.INSTANT,
            referral_rewards_enabled=True,
            referral_reward_amount=Decimal('10.00'),
            referral_max_earnings_per_referrer=Decimal('25.00'),
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Wash',
            duration_minutes=60,
            pricing_type=Service.PricingType.FIXED,
            base_price=Decimal('100.00'),
            fulfillment_kind=Service.FulfillmentKind.SHOP,
            is_active=True,
        )
        self.code = get_or_create_referral_code(
            organization=self.org, referrer=self.referrer,
        )

    def _make_booking(self, customer, *, status=Booking.Status.IN_PROGRESS):
        start = timezone.now() + timedelta(hours=2)
        end = start + timedelta(hours=1)
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

    def test_program_requires_amounts(self):
        self.org.referral_reward_amount = Decimal('0.00')
        self.org.save(update_fields=['referral_reward_amount'])
        self.assertFalse(program_is_active(self.org))

    def test_self_referral_ignored(self):
        booking = self._make_booking(self.referrer, status=Booking.Status.REQUESTED)
        result = attach_referral_attribution(booking=booking, code=self.code.code)
        self.assertIsNone(result)
        self.assertEqual(Referral.objects.count(), 0)

    def test_credit_only_after_referred_job_completed(self):
        booking = self._make_booking(self.referred, status=Booking.Status.CONFIRMED)
        attach_referral_attribution(booking=booking, code=self.code.code)
        ref = Referral.objects.get()
        self.assertEqual(ref.status, Referral.Status.PENDING)
        self.assertEqual(ReferralCoupon.objects.count(), 0)

        booking.status = Booking.Status.IN_PROGRESS
        booking.save(update_fields=['status'])
        complete_booking(booking, staff_user=self.owner)

        ref.refresh_from_db()
        self.assertEqual(ref.status, Referral.Status.REWARDED)
        coupon = ReferralCoupon.objects.get()
        self.assertEqual(coupon.amount, Decimal('10.00'))
        self.assertEqual(coupon.remaining, Decimal('10.00'))
        self.assertEqual(coupon.owner_id, self.referrer.id)

    def test_lifetime_cap_partial_last_reward(self):
        # First two referrals: $10 each = $20. Cap $25 → third grants $5.
        for i in range(3):
            user = User.objects.create_user(
                email=f'ref{i}@luminexa.local',
                password='password123',
                full_name=f'Ref {i}',
                phone=f'+1555222000{i}',
            )
            booking = self._make_booking(user, status=Booking.Status.IN_PROGRESS)
            attach_referral_attribution(booking=booking, code=self.code.code)
            complete_booking(booking, staff_user=self.owner)

        coupons = list(ReferralCoupon.objects.filter(owner=self.referrer).order_by('id'))
        self.assertEqual(len(coupons), 3)
        self.assertEqual(coupons[0].amount, Decimal('10.00'))
        self.assertEqual(coupons[1].amount, Decimal('10.00'))
        self.assertEqual(coupons[2].amount, Decimal('5.00'))

        # Fourth hits hard cap → capped, no coupon
        user4 = User.objects.create_user(
            email='ref4@luminexa.local', password='password123', full_name='Ref 4',
            phone='+15552220004',
        )
        booking4 = self._make_booking(user4, status=Booking.Status.IN_PROGRESS)
        attach_referral_attribution(booking=booking4, code=self.code.code)
        complete_booking(booking4, staff_user=self.owner)
        ref4 = Referral.objects.get(referred_user=user4)
        self.assertEqual(ref4.status, Referral.Status.CAPPED)
        self.assertEqual(ReferralCoupon.objects.filter(owner=self.referrer).count(), 3)

    def test_coupon_applied_on_referrer_invoice(self):
        # Qualify a referral so referrer has $10 credit
        booking_ref = self._make_booking(self.referred, status=Booking.Status.IN_PROGRESS)
        attach_referral_attribution(booking=booking_ref, code=self.code.code)
        complete_booking(booking_ref, staff_user=self.owner)

        # Referrer's own job invoice should consume the coupon
        referrer_booking = self._make_booking(self.referrer, status=Booking.Status.IN_PROGRESS)
        invoice = issue_or_update_invoice(
            referrer_booking,
            staff_user=self.owner,
            subtotal='100.00',
        )
        self.assertEqual(invoice.discount, Decimal('10.00'))
        self.assertEqual(invoice.subtotal, Decimal('100.00'))
        # Tax on 90.00 in ON (13% HST) → 11.70; total 101.70
        self.assertEqual(invoice.tax_total, Decimal('11.70'))
        self.assertEqual(invoice.amount, Decimal('101.70'))

        coupon = ReferralCoupon.objects.get()
        self.assertEqual(coupon.status, ReferralCoupon.Status.APPLIED)
        self.assertEqual(coupon.remaining, Decimal('0.00'))
        self.assertEqual(coupon.last_applied_invoice_id, invoice.id)

    def test_owner_can_patch_referral_settings(self):
        self.client.force_authenticate(self.owner)
        res = self.client.patch(
            f'/api/v1/organizations/{self.org.slug}/',
            {
                'referral_rewards_enabled': True,
                'referral_reward_amount': '15.00',
                'referral_max_earnings_per_referrer': '50.00',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.org.refresh_from_db()
        self.assertEqual(self.org.referral_reward_amount, Decimal('15.00'))
        self.assertEqual(self.org.referral_max_earnings_per_referrer, Decimal('50.00'))

    def test_referral_endpoint_returns_code(self):
        self.client.force_authenticate(self.referrer)
        res = self.client.get(
            f'/api/v1/organizations/{self.org.slug}/referral/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data['enabled'])
        self.assertEqual(res.data['code'], self.code.code)
        self.assertEqual(res.data['reward_amount'], '10.00')

    def test_booking_create_attaches_referral_code(self):
        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(hours=1)
        slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            start_at=start,
            end_at=end,
            status=AvailabilitySlot.Status.OPEN,
        )
        self.client.force_authenticate(self.referred)
        res = self.client.post(
            '/api/v1/bookings/',
            {
                'slot_id': slot.id,
                'service': self.service.id,
                'referral_code': self.code.code,
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(
            Referral.objects.filter(
                referred_user=self.referred,
                referrer=self.referrer,
                status=Referral.Status.PENDING,
            ).exists()
        )

    def test_disable_stops_new_referrals_but_keeps_existing_credit(self):
        booking_ref = self._make_booking(self.referred, status=Booking.Status.IN_PROGRESS)
        attach_referral_attribution(booking=booking_ref, code=self.code.code)
        complete_booking(booking_ref, staff_user=self.owner)
        self.assertEqual(ReferralCoupon.objects.filter(owner=self.referrer).count(), 1)

        self.org.referral_rewards_enabled = False
        self.org.save(update_fields=['referral_rewards_enabled'])

        other = User.objects.create_user(
            email='new-ref@luminexa.local', password='password123', full_name='New',
            phone='+15553330001',
        )
        other_booking = self._make_booking(other, status=Booking.Status.REQUESTED)
        self.assertIsNone(
            attach_referral_attribution(booking=other_booking, code=self.code.code)
        )

        referrer_booking = self._make_booking(self.referrer, status=Booking.Status.IN_PROGRESS)
        invoice = issue_or_update_invoice(
            referrer_booking,
            staff_user=self.owner,
            subtotal='50.00',
        )
        self.assertEqual(invoice.discount, Decimal('10.00'))

    def test_pending_still_qualifies_after_program_disabled(self):
        booking = self._make_booking(self.referred, status=Booking.Status.IN_PROGRESS)
        attach_referral_attribution(booking=booking, code=self.code.code)
        self.org.referral_rewards_enabled = False
        self.org.save(update_fields=['referral_rewards_enabled'])
        complete_booking(booking, staff_user=self.owner)
        self.assertEqual(
            Referral.objects.get(referred_user=self.referred).status,
            Referral.Status.REWARDED,
        )
        self.assertEqual(ReferralCoupon.objects.filter(owner=self.referrer).count(), 1)
