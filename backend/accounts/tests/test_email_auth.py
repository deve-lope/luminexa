from django.core import mail
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from accounts.models import User
from accounts.tokens import email_verification_token
from businesses.models import BusinessType, OrganizationMembership


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    PUBLIC_APP_URL='http://localhost:3000',
)
class EmailVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_customer_register_sends_verification_and_blocks_login(self):
        res = self.client.post(
            '/accounts/api/register/',
            {
                'email': 'new.customer@example.com',
                'full_name': 'New Customer',
                'password': 'password123',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data.get('requires_verification'))
        self.assertNotIn('token', res.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Verify your Luminexa email', mail.outbox[0].subject)

        user = User.objects.get(email='new.customer@example.com')
        self.assertFalse(user.email_verified)

        login = self.client.post(
            '/accounts/api/login/',
            {'email': 'new.customer@example.com', 'password': 'password123'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(login.status_code, 403)
        self.assertEqual(login.data.get('code'), 'email_not_verified')

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_verification_token.make_token(user)
        verify = self.client.post(
            '/accounts/api/verify-email/',
            {'uid': uid, 'token': token},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(verify.status_code, 200, verify.data)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

        login_ok = self.client.post(
            '/accounts/api/login/',
            {'email': 'new.customer@example.com', 'password': 'password123'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(login_ok.status_code, 200, login_ok.data)
        self.assertIn('token', login_ok.data)

    def test_password_reset_flow(self):
        user = User.objects.create_user(
            email='reset.me@example.com',
            full_name='Reset Me',
            password='password123',
            email_verified=True,
        )
        req = self.client.post(
            '/accounts/api/password-reset/',
            {'email': 'reset.me@example.com'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(req.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        body = mail.outbox[0].body
        self.assertIn('/reset-password?uid=', body)

        # Extract uid/token from email URL
        from django.contrib.auth.tokens import default_token_generator

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        confirm = self.client.post(
            '/accounts/api/password-reset/confirm/',
            {'uid': uid, 'token': token, 'password': 'newpass123'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(confirm.status_code, 200, confirm.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password('newpass123'))

    def test_business_register_requires_verification(self):
        BusinessType.objects.create(slug='cleaning', name='Cleaning', is_active=True)
        res = self.client.post(
            '/accounts/api/register/business/',
            {
                'email': 'biz.owner@example.com',
                'full_name': 'Biz Owner',
                'password': 'password123',
                'business_name': 'Verify Biz Co',
                'booking_policy': 'approval',
                'business_type_slugs': ['cleaning'],
                'service_city': 'Ottawa',
                'service_postal_code': 'K1A0B1',
                'service_state': 'ON',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data.get('requires_verification'))
        self.assertTrue(
            OrganizationMembership.objects.filter(user__email='biz.owner@example.com').exists()
        )
        self.assertEqual(len(mail.outbox), 1)
