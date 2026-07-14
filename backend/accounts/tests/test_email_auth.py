from django.core import mail
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from accounts.models import LoginCode, User
from accounts.otp import issue_login_code
from accounts.tokens import email_verification_token
from businesses.models import BusinessType, OrganizationMembership


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    PUBLIC_APP_URL='http://localhost:3000',
)
class EmailVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_customer_register_sends_otp_and_signs_in(self):
        res = self.client.post(
            '/accounts/api/register/',
            {
                'email': 'new.customer@example.com',
                'full_name': 'New Customer',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data.get('requires_otp'))
        self.assertNotIn('token', res.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('sign-in code', mail.outbox[0].subject.lower())

        user = User.objects.get(email='new.customer@example.com')
        self.assertFalse(user.email_verified)
        self.assertFalse(user.has_usable_password())

        body = mail.outbox[0].body
        code = next(line.split(':')[-1].strip() for line in body.splitlines() if 'code is:' in line.lower())

        verify = self.client.post(
            '/accounts/api/login/otp/verify/',
            {'email': 'new.customer@example.com', 'code': code},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(verify.status_code, 200, verify.data)
        self.assertIn('token', verify.data)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

        # Password login is rejected for customers
        login = self.client.post(
            '/accounts/api/login/',
            {'email': 'new.customer@example.com', 'password': 'anything123'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(login.status_code, 400)

    def test_login_start_branches_provider_vs_customer(self):
        customer = User.objects.create_user(
            email='cust@example.com',
            full_name='Cust',
            password=None,
            email_verified=True,
        )
        owner = User.objects.create_user(
            email='owner@example.com',
            full_name='Owner',
            password='password123',
            email_verified=True,
        )
        BusinessType.objects.create(slug='cleaning', name='Cleaning', is_active=True)
        from businesses.models import Organization
        from businesses.utils import unique_organization_slug

        org = Organization.objects.create(
            name='Branch Biz',
            slug=unique_organization_slug('Branch Biz'),
            profile_public=True,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=org,
            user=owner,
            role=OrganizationMembership.Role.OWNER,
        )

        cust_start = self.client.post(
            '/accounts/api/login/start/',
            {'email': customer.email},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(cust_start.status_code, 200, cust_start.data)
        self.assertEqual(cust_start.data['auth_method'], 'otp')
        self.assertEqual(len(mail.outbox), 1)

        owner_start = self.client.post(
            '/accounts/api/login/start/',
            {'email': owner.email},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(owner_start.status_code, 200, owner_start.data)
        self.assertEqual(owner_start.data['auth_method'], 'password')
        self.assertEqual(len(mail.outbox), 1)  # no extra OTP for provider

        login_ok = self.client.post(
            '/accounts/api/login/',
            {'email': owner.email, 'password': 'password123'},
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
        BusinessType.objects.create(slug='reset-biz-type', name='Reset Biz Type', is_active=True)
        from businesses.models import Organization
        from businesses.utils import unique_organization_slug

        org = Organization.objects.create(
            name='Reset Biz',
            slug=unique_organization_slug('Reset Biz'),
            profile_public=True,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=org,
            user=user,
            role=OrganizationMembership.Role.OWNER,
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
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data.get('requires_verification'))
        membership = OrganizationMembership.objects.get(user__email='biz.owner@example.com')
        self.assertEqual(membership.organization.service_city, '')
        self.assertEqual(membership.organization.service_postal_code, '')
        self.assertEqual(len(mail.outbox), 1)

        user = User.objects.get(email='biz.owner@example.com')
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_verification_token.make_token(user)
        verify = self.client.post(
            '/accounts/api/verify-email/',
            {'uid': uid, 'token': token},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(verify.status_code, 200, verify.data)

    def test_business_register_office_type_requires_address(self):
        BusinessType.objects.create(
            slug='salon',
            name='Salon',
            is_active=True,
            location_kind=BusinessType.LocationKind.OFFICE,
        )
        missing = self.client.post(
            '/accounts/api/register/business/',
            {
                'email': 'salon.owner@example.com',
                'full_name': 'Salon Owner',
                'password': 'password123',
                'business_name': 'Studio One',
                'booking_policy': 'approval',
                'business_type_slugs': ['salon'],
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(missing.status_code, 400, missing.data)
        self.assertIn('service_city', missing.data)

        ok = self.client.post(
            '/accounts/api/register/business/',
            {
                'email': 'salon.owner@example.com',
                'full_name': 'Salon Owner',
                'password': 'password123',
                'business_name': 'Studio One',
                'booking_policy': 'approval',
                'business_type_slugs': ['salon'],
                'service_city': 'Ottawa',
                'service_postal_code': 'K1A0B1',
                'service_state': 'ON',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(ok.status_code, 201, ok.data)
        membership = OrganizationMembership.objects.get(user__email='salon.owner@example.com')
        self.assertEqual(membership.organization.service_city, 'Ottawa')
        self.assertEqual(membership.organization.service_postal_code, 'K1A0B1')

    def test_otp_rejects_bad_code(self):
        User.objects.create_user(
            email='otp.fail@example.com',
            full_name='Otp Fail',
            password=None,
            email_verified=False,
        )
        issue_login_code('otp.fail@example.com')
        self.assertEqual(LoginCode.objects.filter(email='otp.fail@example.com').count(), 1)
        bad = self.client.post(
            '/accounts/api/login/otp/verify/',
            {'email': 'otp.fail@example.com', 'code': '000000'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(bad.status_code, 400)
