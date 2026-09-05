"""Subscription ending reminders: 30 days, 7 days, and 2 days before period end."""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from businesses.models import Organization, OrganizationMembership
from jobs.models import ProviderNotification
from jobs.subscription_reminder_services import send_subscription_ending_reminders

User = get_user_model()


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='noreply@test.local',
    PUBLIC_APP_URL='https://app.test',
)
class SubscriptionEndingReminderTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='sub-owner@example.com',
            password='pass12345',
            full_name='Sub Owner',
        )
        self.org = Organization.objects.create(
            name='Ending Soon Co',
            slug='ending-soon',
            subscription_status='trialing',
            subscription_plan='pro_monthly',
            subscription_source='promo',
            subscription_current_period_end=timezone.now() + timedelta(days=30),
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )

    def _set_period_end(self, *, days):
        # Place period_end inside the ~24h reminder window for this tier.
        self.org.subscription_current_period_end = (
            timezone.now() + timedelta(days=days, hours=1)
        )
        self.org.subscription_ending_reminder_30d_for = None
        self.org.subscription_ending_reminder_7d_for = None
        self.org.subscription_ending_reminder_2d_for = None
        self.org.save(
            update_fields=[
                'subscription_current_period_end',
                'subscription_ending_reminder_30d_for',
                'subscription_ending_reminder_7d_for',
                'subscription_ending_reminder_2d_for',
                'updated_at',
            ]
        )

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_sends_30_day_in_app_and_email(self, _push):
        self._set_period_end(days=30)
        sent = send_subscription_ending_reminders()
        self.assertEqual(sent, 1)

        note = ProviderNotification.objects.get(
            organization=self.org,
            kind=ProviderNotification.Kind.SUBSCRIPTION_ENDING,
        )
        self.assertIn('1 month', note.message)
        self.assertEqual(note.link_path, '/provider/ending-soon/billing')

        self.org.refresh_from_db()
        self.assertEqual(
            self.org.subscription_ending_reminder_30d_for,
            self.org.subscription_current_period_end,
        )
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('1 month', mail.outbox[0].subject)
        self.assertIn(self.owner.email, mail.outbox[0].to)
        self.assertIn('/provider/ending-soon/billing', mail.outbox[0].body)

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_sends_7_day_and_2_day_tiers(self, _push):
        self._set_period_end(days=7)
        self.assertEqual(send_subscription_ending_reminders(), 1)
        note = ProviderNotification.objects.latest('id')
        self.assertIn('7 days', note.message)

        self._set_period_end(days=2)
        self.assertEqual(send_subscription_ending_reminders(), 1)
        note = ProviderNotification.objects.latest('id')
        self.assertIn('2 days', note.message)

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_does_not_duplicate_same_tier(self, _push):
        self._set_period_end(days=7)
        self.assertEqual(send_subscription_ending_reminders(), 1)
        self.assertEqual(send_subscription_ending_reminders(), 0)
        self.assertEqual(
            ProviderNotification.objects.filter(
                organization=self.org,
                kind=ProviderNotification.Kind.SUBSCRIPTION_ENDING,
            ).count(),
            1,
        )
        self.assertEqual(len(mail.outbox), 1)

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_skips_paid_stripe_active_auto_renew(self, _push):
        self.org.subscription_status = 'active'
        self.org.subscription_source = 'stripe'
        self.org.subscription_current_period_end = timezone.now() + timedelta(days=7, hours=1)
        self.org.save(
            update_fields=[
                'subscription_status',
                'subscription_source',
                'subscription_current_period_end',
                'updated_at',
            ]
        )
        self.assertEqual(send_subscription_ending_reminders(), 0)
        self.assertEqual(len(mail.outbox), 0)

    @patch('jobs.push_services.send_push_to_org_staff')
    def test_stripe_trial_still_gets_reminder(self, _push):
        self.org.subscription_status = 'trialing'
        self.org.subscription_source = 'stripe'
        self.org.subscription_current_period_end = timezone.now() + timedelta(days=2, hours=1)
        self.org.save(
            update_fields=[
                'subscription_status',
                'subscription_source',
                'subscription_current_period_end',
                'updated_at',
            ]
        )
        self.assertEqual(send_subscription_ending_reminders(), 1)
        self.assertEqual(len(mail.outbox), 1)
