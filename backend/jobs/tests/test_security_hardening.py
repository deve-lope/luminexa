from datetime import timedelta

from django.conf import settings
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.models import AvailabilitySlot, Booking, Service


class SlotPiiRedactionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='sec-owner@test.local',
            password='pass12345',
            full_name='Owner',
            phone='5552000001',
        )
        self.customer = User.objects.create_user(
            email='sec-cust@test.local',
            password='pass12345',
            full_name='Booked Cust',
            phone='5552000002',
        )
        self.other = User.objects.create_user(
            email='sec-other@test.local',
            password='pass12345',
            full_name='Other Cust',
            phone='5552000003',
        )
        self.org = Organization.objects.create(
            name='Sec Co',
            slug='sec-co',
            booking_policy=Organization.BookingPolicy.INSTANT,
            profile_public=True,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.customer,
            role=OrganizationMembership.Role.CUSTOMER,
            customer_status=OrganizationMembership.CustomerStatus.APPROVED,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='Cut',
            duration_minutes=60,
            base_price='20',
            is_active=True,
        )
        start = timezone.now() + timedelta(days=2)
        end = start + timedelta(hours=1)
        self.slot = AvailabilitySlot.objects.create(
            organization=self.org,
            service=self.service,
            status=AvailabilitySlot.Status.BOOKED,
            start_at=start,
            end_at=end,
        )
        Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            availability_slot=self.slot,
            start_at=start,
            end_at=end,
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.CUSTOMER_REQUEST,
            service_address='123 Private St',
        )

    def test_staff_sees_customer_pii_on_slots(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(
            f'/api/v1/availability-slots/?organization={self.org.slug}',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        slots = res.data.get('slots') or res.data
        row = next(s for s in slots if s['id'] == self.slot.id)
        self.assertEqual(row['customer_name'], 'Booked Cust')
        self.assertEqual(row['customer_phone'], '5552000002')
        self.assertEqual(row['service_address'], '123 Private St')

    def test_other_customer_does_not_see_pii_on_slots(self):
        self.client.force_authenticate(user=self.other)
        res = self.client.get(
            f'/api/v1/availability-slots/?organization={self.org.slug}',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        slots = res.data.get('slots') or res.data
        row = next(s for s in slots if s['id'] == self.slot.id)
        self.assertIsNone(row['customer_name'])
        self.assertIsNone(row['customer_phone'])
        self.assertIsNone(row['service_address'])


class CookieAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='cookie-owner@test.local',
            password='pass12345',
            full_name='Cookie Owner',
            phone='5552000010',
            email_verified=True,
        )
        OrganizationMembership.objects.create(
            organization=Organization.objects.create(
                name='Cookie Co',
                slug='cookie-co',
                profile_public=True,
                is_active=True,
            ),
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )

    def test_login_sets_httponly_cookie_without_token_body(self):
        res = self.client.post(
            '/accounts/api/login/',
            {'email': self.owner.email, 'password': 'pass12345'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.assertNotIn('token', res.data)
        self.assertIn(settings.AUTH_TOKEN_COOKIE_NAME, res.cookies)
        cookie = res.cookies[settings.AUTH_TOKEN_COOKIE_NAME]
        self.assertTrue(cookie.get('httponly') or cookie['httponly'])

        # Cookie authenticates subsequent requests without Authorization header.
        self.client.credentials()
        profile = self.client.get('/accounts/api/profile/', HTTP_HOST='localhost')
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.data['email'], self.owner.email)

    def test_logout_clears_cookie(self):
        login = self.client.post(
            '/accounts/api/login/',
            {'email': self.owner.email, 'password': 'pass12345'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(login.status_code, 200)
        out = self.client.post('/accounts/api/logout/', format='json', HTTP_HOST='localhost')
        self.assertEqual(out.status_code, 200)
        profile = self.client.get('/accounts/api/profile/', HTTP_HOST='localhost')
        self.assertEqual(profile.status_code, 401)

    def test_stale_cookie_does_not_block_new_login(self):
        self.client.cookies[settings.AUTH_TOKEN_COOKIE_NAME] = 'stale-deleted-token'
        start = self.client.post(
            '/accounts/api/login/start/',
            {'email': self.owner.email},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(start.status_code, 200, start.data)
        self.assertEqual(start.data['auth_method'], 'password')

        # The same stale cookie still grants no protected access.
        profile = self.client.get('/accounts/api/profile/', HTTP_HOST='localhost')
        self.assertEqual(profile.status_code, 401)


@override_settings(DEBUG=False, SERVE_MEDIA=True)
class MediaAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='media-user@test.local',
            password='pass12345',
            full_name='Media User',
            phone='5552000020',
        )
        media_root = settings.MEDIA_ROOT
        media_root.mkdir(parents=True, exist_ok=True)
        public = media_root / 'orgs' / 'logos'
        public.mkdir(parents=True, exist_ok=True)
        (public / 'logo.txt').write_text('public-logo', encoding='utf-8')
        private = media_root / 'private'
        private.mkdir(parents=True, exist_ok=True)
        (private / 'secret.txt').write_text('top-secret', encoding='utf-8')

    def _body(self, response):
        if hasattr(response, 'streaming_content'):
            return b''.join(response.streaming_content).decode()
        return response.content.decode()

    def test_public_media_prefix_is_open(self):
        res = self.client.get('/media/orgs/logos/logo.txt', HTTP_HOST='localhost')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self._body(res), 'public-logo')

    def test_private_media_requires_auth(self):
        denied = self.client.get('/media/private/secret.txt', HTTP_HOST='localhost')
        self.assertEqual(denied.status_code, 403)

        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        allowed = self.client.get('/media/private/secret.txt', HTTP_HOST='localhost')
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(self._body(allowed), 'top-secret')


@override_settings(SECURE_SSL_REDIRECT=False)
class ServiceLimitTests(TestCase):
    """Providers cannot spam unlimited services (abuse / storage guard)."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='svc-limit-owner@test.local',
            password='pass12345',
            full_name='Owner',
            phone='5552000030',
        )
        self.org = Organization.objects.create(
            name='Limit Co',
            slug='limit-co',
            profile_public=True,
            is_active=True,
            subscription_status='active',
            subscription_plan='pro_monthly',
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )

    def test_create_service_rejected_at_org_max(self):
        from unittest.mock import patch

        with patch.object(Service, 'MAX_PER_ORGANIZATION', 2):
            for i in range(2):
                Service.objects.create(
                    organization=self.org,
                    name=f'Service {i}',
                    duration_minutes=60,
                    base_price='10.00',
                    is_active=True,
                )
            self.client.force_authenticate(user=self.owner)
            res = self.client.post(
                '/api/v1/services/',
                {
                    'organization': self.org.id,
                    'name': 'Too Many',
                    'duration_minutes': 60,
                    'pricing_type': 'fixed',
                    'base_price': '10.00',
                },
                format='json',
                HTTP_HOST='localhost',
            )
            self.assertEqual(res.status_code, 400, res.data)
            self.assertEqual(res.data.get('code'), 'service_limit')
            self.assertEqual(self.org.services.count(), 2)
