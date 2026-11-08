from django.conf import settings
from django.test import TestCase, override_settings

from accounts.models import User
from businesses.models import Organization, OrganizationMembership


@override_settings(
    MARKETING_DEMO_ENABLED=True,
    MARKETING_DEMO_PROVIDER_EMAIL='demo.marketing.provider@luminex-a.com',
    MARKETING_DEMO_ORG_SLUG='luminexa-demo-test',
    MARKETING_DEMO_PASSWORD='test-demo-password',
    MARKETING_DEMO_MAX_SESSIONS=50,
    SECURE_SSL_REDIRECT=False,
)
class MarketingDemoLoginTests(TestCase):
    def setUp(self):
        from django.core.management import call_command

        call_command('ensure_marketing_demo_accounts', password='test-demo-password')
        self.url = '/accounts/api/login/marketing-demo/'
        self.email = 'demo.marketing.provider@luminex-a.com'

    def _demo_login(self):
        res = self.client.post(self.url, {}, HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200, res.content)
        return res

    def test_marketing_demo_login_issues_cookie_and_org(self):
        res = self._demo_login()
        self.assertEqual(res.data.get('org_slug'), 'luminexa-demo-test')
        self.assertTrue(res.data.get('is_marketing_demo'))
        self.assertTrue(res.data['user']['is_marketing_demo'])
        self.assertIn(settings.AUTH_TOKEN_COOKIE_NAME, res.cookies)

    def test_disabled_returns_503(self):
        with override_settings(MARKETING_DEMO_ENABLED=False):
            res = self.client.post(self.url, {}, HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 503)
        self.assertEqual(res.data.get('code'), 'demo_disabled')

    def test_seed_creates_private_org_and_owner(self):
        org = Organization.objects.get(slug='luminexa-demo-test')
        self.assertGreaterEqual(org.services.filter(is_active=True).count(), 4)
        self.assertEqual(org.subscription_status, 'trialing')
        self.assertFalse(org.profile_public)
        owner = User.objects.get(email=self.email)
        self.assertTrue(
            OrganizationMembership.objects.filter(
                user=owner,
                organization=org,
                role=OrganizationMembership.Role.OWNER,
            ).exists()
        )

    def test_password_login_rejected(self):
        res = self.client.post(
            '/accounts/api/login/',
            {'email': self.email, 'password': 'test-demo-password'},
            HTTP_HOST='localhost',
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 400)

    def test_login_start_rejected(self):
        res = self.client.post(
            '/accounts/api/login/start/',
            {'email': self.email},
            HTTP_HOST='localhost',
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data.get('code'), 'use_marketing_demo')

    def test_write_guard_blocks_delete_account(self):
        self._demo_login()
        res = self.client.post(
            '/accounts/api/account/delete/',
            {},
            HTTP_HOST='localhost',
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json().get('code'), 'marketing_demo_readonly')

    def test_write_guard_blocks_org_billing(self):
        self._demo_login()
        res = self.client.post(
            '/api/v1/organizations/luminexa-demo-test/billing/connect/onboard/',
            {},
            HTTP_HOST='localhost',
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json().get('code'), 'marketing_demo_readonly')

    def test_write_guard_allows_logout(self):
        self._demo_login()
        res = self.client.post('/accounts/api/logout/', {}, HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
