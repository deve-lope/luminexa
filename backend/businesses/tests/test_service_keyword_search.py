"""Related / synonym-aware customer service keyword search."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from businesses.models import BusinessType, Organization, OrganizationLocation, OrganizationMembership
from jobs.models import Service, ServiceCategory

User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class RelatedServiceKeywordSearchTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.auto_type = BusinessType.objects.create(
            slug='auto-vehicles',
            name='Auto & vehicles',
            description='Wash, detailing, tires, jump starts, and mobile auto care',
            is_active=True,
        )
        self.org = Organization.objects.create(
            name='Sparkle Auto',
            slug='sparkle-auto-related',
            profile_public=True,
            is_active=True,
            service_postal_code='78701',
            service_latitude=Decimal('30.267200'),
            service_longitude=Decimal('-97.743100'),
            service_radius_miles=Decimal('25'),
        )
        self.org.business_types.add(self.auto_type)
        OrganizationLocation.objects.create(
            organization=self.org,
            name='Primary',
            is_primary=True,
            postal_code='78701',
            latitude=Decimal('30.267200'),
            longitude=Decimal('-97.743100'),
            radius_miles=Decimal('25'),
        )
        self.cat = ServiceCategory.objects.create(
            organization=self.org,
            name='Auto & vehicles',
            sort_order=1,
            is_active=True,
        )
        self.car_wash = Service.objects.create(
            organization=self.org,
            category=self.cat,
            name='Car wash',
            description='Exterior rinse and dry',
            duration_minutes=45,
            base_price='49.00',
            is_active=True,
        )

    def test_detailing_interior_returns_car_wash_via_category(self):
        res = self.client.get(
            '/api/v1/public/services/',
            {
                'lat': '30.2672',
                'lng': '-97.7431',
                'radius_miles': '25',
                'q': 'detailing interior',
            },
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        names = [s['name'] for s in res.data.get('services', [])]
        self.assertIn('Car wash', names)
        self.assertEqual(res.data.get('match_mode'), 'related')

    def test_phrase_match_is_exact_mode(self):
        res = self.client.get(
            '/api/v1/public/services/',
            {
                'lat': '30.2672',
                'lng': '-97.7431',
                'radius_miles': '25',
                'q': 'Car wash',
            },
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        names = [s['name'] for s in res.data.get('services', [])]
        self.assertIn('Car wash', names)
        self.assertEqual(res.data.get('match_mode'), 'exact')


@override_settings(SECURE_SSL_REDIRECT=False)
class DiscoverRelatedKeywordGuardTests(TestCase):
    """Org name alone must not dump unrelated services (still holds with synonyms)."""

    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            email='related-guard@luminexa.local',
            password='password123',
            full_name='Related Guard',
            phone='+15550002222',
        )
        self.org = Organization.objects.create(
            name='AJ Cleaning',
            slug='aj-clean-related-guard',
            profile_public=True,
            is_active=True,
            service_city='Ottawa',
            service_state='ON',
            service_postal_code='K2C1P4',
            service_latitude='45.359208',
            service_longitude='-75.706422',
            service_radius_miles='50',
        )
        bt = BusinessType.objects.create(
            slug='cleaning-related-guard',
            name='Cleaning',
            description='Home cleaning',
            is_active=True,
        )
        self.org.business_types.add(bt)
        Service.objects.create(
            organization=self.org,
            name='Deep cleaning',
            duration_minutes=60,
            base_price='80.00',
            is_active=True,
        )
        Service.objects.create(
            organization=self.org,
            name='Oil change',
            duration_minutes=30,
            base_price='40.00',
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.customer,
            role=OrganizationMembership.Role.CUSTOMER,
        )
        self.client.force_authenticate(self.customer)

    def test_clean_does_not_return_oil_change(self):
        res = self.client.get(
            '/api/v1/customer/discover/',
            {'q': 'clean'},
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        names = [s['name'] for s in res.data.get('services') or []]
        self.assertIn('Deep cleaning', names)
        self.assertNotIn('Oil change', names)
