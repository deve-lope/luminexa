"""Admin password reset must require Google Authenticator (TOTP)."""

from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django_otp.oath import totp
from django_otp.plugins.otp_totp.models import TOTPDevice

from accounts.models import User


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    PUBLIC_APP_URL='https://app.luminex-a.com',
    SECURE_SSL_REDIRECT=False,
)
class AdminPasswordResetTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='admin-reset@test.local',
            full_name='Admin',
            password='oldpass123',
        )
        self.device = TOTPDevice.objects.create(user=self.admin, name='default', confirmed=True)

    def _uid_token(self):
        uid = urlsafe_base64_encode(force_bytes(self.admin.pk))
        token = default_token_generator.make_token(self.admin)
        return uid, token

    def _current_otp(self):
        return f'{totp(self.device.bin_key):06d}'

    def test_admin_reset_without_otp_rejected(self):
        uid, token = self._uid_token()
        res = self.client.post(
            '/accounts/api/password-reset/confirm/',
            {'uid': uid, 'token': token, 'password': 'newpass123'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('otp', res.data)
        self.assertEqual(res.data.get('code'), 'admin_otp_required')
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password('oldpass123'))

    def test_admin_reset_with_valid_otp_ok(self):
        uid, token = self._uid_token()
        res = self.client.post(
            '/accounts/api/password-reset/confirm/',
            {
                'uid': uid,
                'token': token,
                'password': 'newpass123',
                'otp': self._current_otp(),
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password('newpass123'))

    def test_admin_reset_request_link_includes_requires_otp(self):
        res = self.client.post(
            '/accounts/api/password-reset/',
            {'email': 'admin-reset@test.local'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('requires_otp=1', mail.outbox[0].body)
