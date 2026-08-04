from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.deletion import anonymize_user
from accounts.models import LoginCode, User
from businesses.models import Organization, OrganizationMembership


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    PUBLIC_APP_URL='http://localhost:3000',
    SECURE_SSL_REDIRECT=False,
)
class AccountDeletionTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def _make_user(self, email='del.me@example.com'):
        user = User.objects.create_user(email=email, full_name='Del Me')
        user.phone = '+1 555 111 2222'
        user.default_service_address = '1 Main St'
        user.address_country = 'Canada'
        user.email_verified = True
        user.save()
        return user

    def test_anonymize_scrubs_pii_and_keeps_row(self):
        user = self._make_user()
        Token.objects.create(user=user)
        LoginCode.objects.create(
            email=user.email, code_hash='x', expires_at='2999-01-01T00:00:00Z'
        )

        self.assertTrue(anonymize_user(user))
        user.refresh_from_db()

        self.assertIsNotNone(user.deleted_at)
        self.assertFalse(user.is_active)
        self.assertEqual(user.full_name, 'Deleted user')
        self.assertNotIn('del.me@example.com', user.email)
        self.assertEqual(user.phone, '')
        self.assertEqual(user.default_service_address, '')
        self.assertFalse(user.has_usable_password())
        self.assertFalse(Token.objects.filter(user=user).exists())
        self.assertFalse(LoginCode.objects.filter(email='del.me@example.com').exists())

    def test_anonymize_is_idempotent(self):
        user = self._make_user()
        self.assertTrue(anonymize_user(user))
        self.assertFalse(anonymize_user(user))

    def test_owned_org_is_deactivated(self):
        user = self._make_user('owner@example.com')
        org = Organization.objects.create(name='My Biz', slug='my-biz')
        OrganizationMembership.objects.create(
            organization=org, user=user, role=OrganizationMembership.Role.OWNER
        )
        anonymize_user(user)
        org.refresh_from_db()
        self.assertFalse(org.is_active)
        self.assertFalse(org.profile_public)

    def test_authenticated_delete_endpoint_requires_confirm(self):
        user = self._make_user()
        self.client.force_authenticate(user=user)
        res = self.client.post('/accounts/api/account/delete/', {}, format='json')
        self.assertEqual(res.status_code, 400, res.data)
        user.refresh_from_db()
        self.assertIsNone(user.deleted_at)

    def test_provider_delete_requires_reason(self):
        user = self._make_user('owner@example.com')
        org = Organization.objects.create(
            name='My Biz',
            slug='my-biz',
            subscription_status='trialing',
            subscription_plan='pro_monthly',
        )
        OrganizationMembership.objects.create(
            organization=org, user=user, role=OrganizationMembership.Role.OWNER
        )
        self.client.force_authenticate(user=user)
        res = self.client.post(
            '/accounts/api/account/delete/', {'confirm': True}, format='json'
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn('deletion_reason', res.data)
        user.refresh_from_db()
        self.assertIsNone(user.deleted_at)

    def test_provider_delete_records_feedback(self):
        from accounts.models import ProviderDeletionFeedback

        user = self._make_user('churn@example.com')
        org = Organization.objects.create(
            name='Churn Co',
            slug='churn-co',
            subscription_status='active',
            subscription_plan='pro_monthly',
            subscription_source='stripe',
        )
        OrganizationMembership.objects.create(
            organization=org, user=user, role=OrganizationMembership.Role.OWNER
        )
        self.client.force_authenticate(user=user)
        res = self.client.post(
            '/accounts/api/account/delete/',
            {
                'confirm': True,
                'deletion_reason': 'too_expensive',
                'deletion_detail': 'Would renew at half price',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        user.refresh_from_db()
        self.assertIsNotNone(user.deleted_at)
        fb = ProviderDeletionFeedback.objects.get(user_id_snapshot=user.pk)
        self.assertEqual(fb.reason, 'too_expensive')
        self.assertEqual(fb.detail, 'Would renew at half price')
        self.assertEqual(fb.organization_slug, 'churn-co')
        self.assertTrue(fb.was_owner)
        self.assertTrue(fb.had_active_subscription)
        self.assertEqual(fb.channel, 'in_app')

    def test_customer_delete_still_works_without_reason(self):
        user = self._make_user('customer@example.com')
        self.client.force_authenticate(user=user)
        res = self.client.post(
            '/accounts/api/account/delete/', {'confirm': True}, format='json'
        )
        self.assertEqual(res.status_code, 200, res.data)
        user.refresh_from_db()
        self.assertIsNotNone(user.deleted_at)

    def test_public_request_sends_email_and_confirm_deletes(self):
        user = self._make_user('public.del@example.com')

        res = self.client.post(
            '/accounts/api/account/delete/request/',
            {'email': 'public.del@example.com'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('delet', mail.outbox[0].subject.lower())

        body = mail.outbox[0].body
        link = next(line.strip() for line in body.splitlines() if '/delete-account' in line)
        query = link.split('?', 1)[1]
        params = dict(pair.split('=', 1) for pair in query.split('&'))

        confirm = self.client.post(
            '/accounts/api/account/delete/confirm/',
            {'uid': params['uid'], 'token': params['token']},
            format='json',
        )
        self.assertEqual(confirm.status_code, 200, confirm.data)
        user.refresh_from_db()
        self.assertIsNotNone(user.deleted_at)

    def test_public_request_unknown_email_is_generic_no_email(self):
        res = self.client.post(
            '/accounts/api/account/delete/request/',
            {'email': 'nobody@example.com'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(mail.outbox), 0)

    def test_confirm_rejects_bad_token(self):
        user = self._make_user('badtoken@example.com')
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        res = self.client.post(
            '/accounts/api/account/delete/confirm/',
            {'uid': uid, 'token': 'not-a-real-token'},
            format='json',
        )
        self.assertEqual(res.status_code, 400, res.data)
        user.refresh_from_db()
        self.assertIsNone(user.deleted_at)
