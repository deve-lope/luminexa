from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from businesses.models import BusinessType, Organization, OrganizationMembership
from jobs.models import Service

User = get_user_model()


class CustomerDiscoverKeywordTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            email='discover-cust@luminexa.local',
            password='password123',
            full_name='Discover Cust',
            phone='+15550001111',
        )
        self.org = Organization.objects.create(
            name='AJ Cleaning',
            slug='aj-clean-discover',
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
            slug='cleaning-discover',
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
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.customer,
            role=OrganizationMembership.Role.CUSTOMER,
        )
        self.client.force_authenticate(self.customer)

    def test_keyword_search_cleaning_returns_services(self):
        res = self.client.get(
            '/api/v1/customer/discover/',
            {'q': 'cleaning'},
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        names = [s['name'] for s in res.data.get('services') or []]
        self.assertIn('Deep cleaning', names)

    def test_org_name_alone_does_not_dump_unrelated_services(self):
        """“clean” matching “AJ Cleaning” must not return oil change from that org."""
        Service.objects.create(
            organization=self.org,
            name='Oil change',
            duration_minutes=30,
            base_price='40.00',
            is_active=True,
        )
        res = self.client.get(
            '/api/v1/customer/discover/',
            {'q': 'clean'},
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        names = [s['name'] for s in res.data.get('services') or []]
        self.assertIn('Deep cleaning', names)
        self.assertNotIn('Oil change', names)

    def test_keyword_with_nearby_coords(self):
        res = self.client.get(
            '/api/v1/customer/discover/',
            {
                'q': 'cleaning',
                'lat': '45.359',
                'lng': '-75.706',
                'radius_miles': '25',
                'postal': 'K2C1P4',
            },
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        names = [s['name'] for s in res.data.get('services') or []]
        self.assertIn('Deep cleaning', names)
