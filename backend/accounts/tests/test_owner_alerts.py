from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import BusinessType
from luminexa.security import classify_suspicious


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    OWNER_ALERT_EMAIL='owner@luminex-a.com',
    PUBLIC_APP_URL='http://localhost:3000',
    SECURITY_FAILED_LOGIN_THRESHOLD=3,
    SECURITY_FAILED_LOGIN_WINDOW=600,
    SECURITY_SIGNUP_BURST_THRESHOLD=2,
    SECURITY_SIGNUP_BURST_WINDOW=1800,
    SECURITY_PROBE_THRESHOLD=2,
    SECURITY_PROBE_WINDOW=600,
    SECURITY_5XX_SPIKE_THRESHOLD=3,
    SECURITY_5XX_SPIKE_WINDOW=300,
    SECURITY_RATELIMIT_ALERT_THRESHOLD=2,
    SECURITY_RATELIMIT_ALERT_WINDOW=600,
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'owner-alerts-tests',
        }
    },
)
class OwnerAlertTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        BusinessType.objects.create(slug='cleaning', name='Cleaning', is_active=True)

    def _owner_mails(self):
        return [m for m in mail.outbox if m.to == ['owner@luminex-a.com']]

    def test_customer_register_notifies_owner_without_secrets(self):
        res = self.client.post(
            '/accounts/api/register/',
            {'email': 'new.customer@example.com', 'full_name': 'New Customer'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        owner_mails = self._owner_mails()
        self.assertEqual(len(owner_mails), 1)
        body = owner_mails[0].body.lower()
        self.assertIn('customer', body)
        self.assertIn('timestamp', body)
        self.assertNotIn('sign-in code', body)
        self.assertNotRegex(body, r'password\s*[:=]')
        self.assertTrue(any('sign-in code' in m.subject.lower() for m in mail.outbox))

    def test_business_register_notifies_owner_with_role(self):
        res = self.client.post(
            '/accounts/api/register/business/',
            {
                'email': 'biz@example.com',
                'full_name': 'Biz Owner',
                'password': 'secretpass123',
                'business_name': 'Biz Co',
                'business_type_slugs': ['cleaning'],
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        owner_mails = self._owner_mails()
        self.assertEqual(len(owner_mails), 1)
        self.assertIn('business_owner', owner_mails[0].body)
        self.assertIn('Biz Co', owner_mails[0].body)
        self.assertNotIn('secretpass123', owner_mails[0].body)

    @override_settings(OWNER_ALERT_EMAIL='')
    def test_no_owner_email_when_unset(self):
        res = self.client.post(
            '/accounts/api/register/',
            {'email': 'quiet@example.com', 'full_name': 'Quiet'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(self._owner_mails(), [])

    def test_failed_logins_email_once_at_threshold(self):
        User.objects.create_user(
            email='owner@example.com',
            full_name='Owner',
            password='correct-password',
            email_verified=True,
        )
        for _ in range(3):
            self.client.post(
                '/accounts/api/login/',
                {'email': 'owner@example.com', 'password': 'wrong-password'},
                format='json',
                HTTP_HOST='localhost',
            )
        alerts = [m for m in self._owner_mails() if 'failed logins' in m.subject.lower()]
        self.assertEqual(len(alerts), 1)
        self.assertNotIn('wrong-password', alerts[0].body)
        self.assertNotIn('correct-password', alerts[0].body)

        self.client.post(
            '/accounts/api/login/',
            {'email': 'owner@example.com', 'password': 'wrong-password'},
            format='json',
            HTTP_HOST='localhost',
        )
        alerts = [m for m in self._owner_mails() if 'failed logins' in m.subject.lower()]
        self.assertEqual(len(alerts), 1)

    def test_probe_paths_are_classified_and_throttled(self):
        self.assertEqual(classify_suspicious('/ottawa/', ''), None)
        self.assertEqual(classify_suspicious('/book/acme', ''), None)
        self.assertEqual(
            classify_suspicious('/search', 'q=1+UNION+SELECT+password+FROM+users'),
            'sql_injection',
        )
        self.assertEqual(classify_suspicious('/static/../etc/passwd', ''), 'path_traversal')

        self.client.get('/wp-admin/', HTTP_HOST='localhost')
        self.client.get('/.env', HTTP_HOST='localhost')
        alerts = [m for m in self._owner_mails() if 'suspicious' in m.subject.lower()]
        self.assertEqual(len(alerts), 1)

    def test_5xx_spike_sends_throttled_alert(self):
        from accounts.owner_alerts import record_server_error
        from django.test import RequestFactory

        request = RequestFactory().get('/api/v1/boom/')
        for _ in range(3):
            record_server_error(request, 500)
        alerts = [m for m in self._owner_mails() if '5xx' in m.subject.lower()]
        self.assertEqual(len(alerts), 1)
        record_server_error(request, 502)
        alerts = [m for m in self._owner_mails() if '5xx' in m.subject.lower()]
        self.assertEqual(len(alerts), 1)


class RegisterThrottleTests(TestCase):
    def test_register_throttle_blocks_after_parsed_rate(self):
        from rest_framework.test import APIRequestFactory
        from luminexa.throttles import RegisterThrottle

        class TightRegisterThrottle(RegisterThrottle):
            rate = '2/hour'

        factory = APIRequestFactory()
        throttle = TightRegisterThrottle()
        request = factory.post('/accounts/api/register/')
        request.META['REMOTE_ADDR'] = '203.0.113.50'
        view = type('V', (), {})()
        self.assertTrue(throttle.allow_request(request, view))
        self.assertTrue(throttle.allow_request(request, view))
        self.assertFalse(throttle.allow_request(request, view))
        self.assertEqual(RegisterThrottle.scope, 'register')
