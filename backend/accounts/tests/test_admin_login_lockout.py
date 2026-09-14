"""Django admin login lockout: 10 failed attempts per day + alert email."""

from django.core import mail
from django.test import RequestFactory, TestCase, override_settings

from accounts.admin_lockout import (
    ADMIN_LOGIN_MAX_FAILURES_PER_DAY,
    admin_login_is_locked,
    clear_admin_login_lockout,
    record_admin_login_failure,
)
from accounts.admin_login import AdminAuthenticationForm
from accounts.models import AdminLoginFailureDay, User


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class AdminLoginLockoutTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.email = 'admin.lock@test.local'
        self.user = User.objects.create_superuser(
            email=self.email,
            full_name='Admin Lock',
            password='correct-password-123',
        )

    def test_locks_after_ten_failures_and_emails_once(self):
        request = self.factory.post('/account/login/')
        request.META['REMOTE_ADDR'] = '203.0.113.10'

        for _ in range(ADMIN_LOGIN_MAX_FAILURES_PER_DAY):
            record_admin_login_failure(email=self.email, request=request)

        self.assertTrue(admin_login_is_locked(email=self.email))
        self.assertTrue(admin_login_is_locked(ip='203.0.113.10'))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('admin login locked', mail.outbox[0].subject.lower())

        # Further failures do not spam extra alert emails.
        record_admin_login_failure(email=self.email, request=request)
        self.assertEqual(len(mail.outbox), 1)

    def test_clear_lockout_allows_retries(self):
        request = self.factory.post('/account/login/')
        request.META['REMOTE_ADDR'] = '203.0.113.11'
        for _ in range(ADMIN_LOGIN_MAX_FAILURES_PER_DAY):
            record_admin_login_failure(email=self.email, request=request)
        self.assertTrue(admin_login_is_locked(email=self.email))

        clear_admin_login_lockout(email=self.email, ip='203.0.113.11')
        self.assertFalse(admin_login_is_locked(email=self.email, ip='203.0.113.11'))
        self.assertFalse(
            AdminLoginFailureDay.objects.filter(key=f'email:{self.email}').exists()
        )

    @override_settings(SUPPORT_EMAIL='ops@luminex-a.com')
    def test_auth_form_blocks_when_locked(self):
        request = self.factory.post('/account/login/')
        request.META['REMOTE_ADDR'] = '198.51.100.9'
        for _ in range(ADMIN_LOGIN_MAX_FAILURES_PER_DAY):
            record_admin_login_failure(email=self.email, request=request)

        form = AdminAuthenticationForm(
            request=request,
            data={'username': self.email, 'password': 'wrong-password'},
        )
        self.assertFalse(form.is_valid())
        self.assertTrue(
            any('Too many failed admin login attempts' in str(e) for e in form.non_field_errors())
        )
