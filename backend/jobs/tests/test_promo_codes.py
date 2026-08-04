"""Promo code complimentary Pro access."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from businesses.models import Organization, OrganizationMembership, PromoCode, PromoRedemption
from jobs.permissions import org_has_active_subscription
from jobs.stripe_services import apply_subscription_from_stripe

User = get_user_model()


@override_settings(STRIPE_SECRET_KEY='sk_test_fake', STRIPE_ENABLED=True, SECURE_SSL_REDIRECT=False)
class PromoCodeRedeemTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='promo-owner@example.com',
            full_name='Owner',
            password='pass12345',
        )
        self.staff = User.objects.create_user(
            email='promo-staff@example.com',
            full_name='Staff',
            password='pass12345',
        )
        self.org = Organization.objects.create(
            name='Promo Org',
            slug='promo-org',
            subscription_status='none',
            subscription_plan='free',
            subscription_source='none',
        )
        OrganizationMembership.objects.create(
            user=self.owner,
            organization=self.org,
            role=OrganizationMembership.Role.OWNER,
        )
        OrganizationMembership.objects.create(
            user=self.staff,
            organization=self.org,
            role=OrganizationMembership.Role.STAFF,
        )
        self.promo = PromoCode.objects.create(
            code='launch4w',
            grant_weeks=4,
            is_active=True,
            created_by=self.owner,
        )
        self.url = f'/api/v1/organizations/{self.org.slug}/billing/redeem-promo/'

    def _redeem(self, user, code='LAUNCH4W'):
        self.client.force_authenticate(user=user)
        return self.client.post(self.url, {'code': code}, HTTP_HOST='localhost')

    def test_owner_redeems_success(self):
        before = timezone.now()
        res = self._redeem(self.owner)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.org.refresh_from_db()
        self.assertEqual(self.org.subscription_status, 'trialing')
        self.assertEqual(self.org.subscription_plan, 'pro_monthly')
        self.assertEqual(self.org.subscription_source, 'promo')
        self.assertIsNotNone(self.org.subscription_current_period_end)
        self.assertGreater(
            self.org.subscription_current_period_end,
            before + timedelta(weeks=3),
        )
        self.assertTrue(org_has_active_subscription(self.org))
        self.assertEqual(PromoRedemption.objects.filter(organization=self.org).count(), 1)
        self.assertEqual(res.data['subscription']['source'], 'promo')
        self.assertTrue(res.data['subscription']['active'])

    def test_staff_cannot_redeem(self):
        res = self._redeem(self.staff)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_code(self):
        res = self._redeem(self.owner, code='NOPE')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_code(self):
        self.promo.valid_until = timezone.now() - timedelta(days=1)
        self.promo.save(update_fields=['valid_until'])
        res = self._redeem(self.owner)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_max_redemptions(self):
        self.promo.max_redemptions = 1
        self.promo.save(update_fields=['max_redemptions'])
        other = Organization.objects.create(name='Other', slug='promo-other')
        OrganizationMembership.objects.create(
            user=self.owner,
            organization=other,
            role=OrganizationMembership.Role.OWNER,
        )
        res1 = self._redeem(self.owner)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.owner)
        res2 = self.client.post(
            f'/api/v1/organizations/{other.slug}/billing/redeem-promo/',
            {'code': 'LAUNCH4W'},
            HTTP_HOST='localhost',
        )
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_org_redeem_rejected(self):
        self.assertEqual(self._redeem(self.owner).status_code, status.HTTP_200_OK)
        res = self._redeem(self.owner)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_promo_grant_denies_access(self):
        self.org.subscription_status = 'trialing'
        self.org.subscription_plan = 'pro_monthly'
        self.org.subscription_source = 'promo'
        self.org.subscription_current_period_end = timezone.now() - timedelta(hours=1)
        self.org.save()
        self.assertFalse(org_has_active_subscription(self.org))

    def test_stripe_webhook_does_not_clobber_active_promo(self):
        self.org.subscription_status = 'trialing'
        self.org.subscription_plan = 'pro_monthly'
        self.org.subscription_source = 'promo'
        self.org.subscription_current_period_end = timezone.now() + timedelta(weeks=2)
        self.org.save()

        apply_subscription_from_stripe(
            org=self.org,
            subscription={
                'id': 'sub_canceled_1',
                'status': 'canceled',
                'metadata': {'plan': 'pro_monthly'},
                'current_period_end': int((timezone.now() + timedelta(days=1)).timestamp()),
            },
        )
        self.org.refresh_from_db()
        self.assertEqual(self.org.subscription_source, 'promo')
        self.assertEqual(self.org.subscription_status, 'trialing')
        self.assertTrue(org_has_active_subscription(self.org))
        self.assertEqual(self.org.stripe_subscription_id, 'sub_canceled_1')

    def test_stripe_active_takes_over_promo(self):
        self.org.subscription_status = 'trialing'
        self.org.subscription_plan = 'pro_monthly'
        self.org.subscription_source = 'promo'
        self.org.subscription_current_period_end = timezone.now() + timedelta(weeks=2)
        self.org.save()

        apply_subscription_from_stripe(
            org=self.org,
            subscription={
                'id': 'sub_active_1',
                'status': 'active',
                'metadata': {'plan': 'pro_monthly'},
                'current_period_end': int((timezone.now() + timedelta(days=30)).timestamp()),
            },
        )
        self.org.refresh_from_db()
        self.assertEqual(self.org.subscription_source, 'stripe')
        self.assertEqual(self.org.subscription_status, 'active')
        self.assertTrue(org_has_active_subscription(self.org))


@override_settings(SECURE_SSL_REDIRECT=False)
class PromoOfferNotificationTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name='Offer Org',
            slug='offer-org',
            subscription_status='trialing',
            subscription_current_period_end=timezone.now() + timedelta(days=3),
        )
        self.other = Organization.objects.create(name='Other Org', slug='other-org')
        self.promo = PromoCode.objects.create(
            code='KEEP2W',
            grant_weeks=2,
            is_active=True,
        )

    def test_send_creates_promo_offer_notifications(self):
        from jobs.models import ProviderNotification
        from jobs.promo_services import send_promo_offer_notifications

        created = send_promo_offer_notifications(
            organizations=[self.org, self.other],
            promo=self.promo,
        )
        self.assertEqual(created, 2)
        notes = ProviderNotification.objects.filter(kind=ProviderNotification.Kind.PROMO_OFFER)
        self.assertEqual(notes.count(), 2)
        note = notes.get(organization=self.org)
        self.assertIn('KEEP2W', note.message)
        self.assertEqual(note.link_path, '/provider/offer-org/billing?promo=KEEP2W')

    def test_send_skips_already_redeemed(self):
        from jobs.models import ProviderNotification
        from jobs.promo_services import send_promo_offer_notifications

        PromoRedemption.objects.create(
            promo_code=self.promo,
            organization=self.org,
            granted_until=timezone.now() + timedelta(weeks=2),
        )
        created = send_promo_offer_notifications(
            organizations=[self.org, self.other],
            promo=self.promo,
        )
        self.assertEqual(created, 1)
        self.assertFalse(
            ProviderNotification.objects.filter(
                organization=self.org,
                kind=ProviderNotification.Kind.PROMO_OFFER,
            ).exists()
        )
        self.assertTrue(
            ProviderNotification.objects.filter(
                organization=self.other,
                kind=ProviderNotification.Kind.PROMO_OFFER,
            ).exists()
        )
