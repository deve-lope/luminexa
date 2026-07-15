from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from businesses.location import organization_distances_within_radius
from businesses.models import Organization, OrganizationLocation, OrganizationMembership


class OrganizationDistanceRadiusTests(TestCase):
    def setUp(self):
        self.near = Organization.objects.create(
            name='Near Co',
            slug='near-co',
            profile_public=True,
            is_active=True,
            service_postal_code='78701',
            service_latitude=Decimal('30.267200'),
            service_longitude=Decimal('-97.743100'),
            service_radius_miles=Decimal('10'),
        )
        OrganizationLocation.objects.create(
            organization=self.near,
            name='Primary',
            is_primary=True,
            postal_code='78701',
            latitude=Decimal('30.267200'),
            longitude=Decimal('-97.743100'),
            radius_miles=Decimal('10'),
        )
        # ~20 miles north
        self.mid = Organization.objects.create(
            name='Mid Co',
            slug='mid-co',
            profile_public=True,
            is_active=True,
            service_postal_code='78758',
            service_latitude=Decimal('30.550000'),
            service_longitude=Decimal('-97.700000'),
            service_radius_miles=Decimal('5'),
        )
        OrganizationLocation.objects.create(
            organization=self.mid,
            name='Primary',
            is_primary=True,
            postal_code='78758',
            latitude=Decimal('30.550000'),
            longitude=Decimal('-97.700000'),
            radius_miles=Decimal('5'),
        )
        self.ungeocoded = Organization.objects.create(
            name='Zip Only Co',
            slug='zip-only',
            profile_public=True,
            is_active=True,
            service_postal_code='78701',
        )
        OrganizationLocation.objects.create(
            organization=self.ungeocoded,
            name='Primary',
            is_primary=True,
            postal_code='78701',
            latitude=None,
            longitude=None,
        )

    def test_provider_service_radius_hides_providers_outside_their_area(self):
        """Customer 25 mi + provider serves 5 mi at ~20 mi away → hidden."""
        dist_map = organization_distances_within_radius(30.2672, -97.7431, 25)
        self.assertIn(self.near.id, dist_map)
        self.assertNotIn(self.mid.id, dist_map)

    def test_provider_visible_when_inside_both_radii(self):
        # near is at the search center with provider radius 10 → visible at any customer radius >= 0
        dist_map = organization_distances_within_radius(30.2672, -97.7431, 25)
        self.assertIn(self.near.id, dist_map)
        self.assertEqual(dist_map[self.near.id], 0.0)

    def test_tight_customer_radius_excludes_far_providers(self):
        dist_map = organization_distances_within_radius(30.2672, -97.7431, 5)
        self.assertIn(self.near.id, dist_map)
        self.assertNotIn(self.mid.id, dist_map)

    def test_ungeocoded_orgs_included_when_postal_matches(self):
        dist_map = organization_distances_within_radius(
            30.2672, -97.7431, 25, search_postal='78701',
        )
        self.assertIn(self.ungeocoded.id, dist_map)
        self.assertEqual(dist_map[self.ungeocoded.id], 0.0)

    def test_org_matches_if_any_location_is_within_provider_and_customer_radius(self):
        # Far branch (outside its own 5 mi) + nearby branch that serves 15 mi
        OrganizationLocation.objects.filter(organization=self.mid).update(is_primary=False)
        OrganizationLocation.objects.create(
            organization=self.mid,
            name='Downtown',
            is_primary=True,
            postal_code='78701',
            latitude=Decimal('30.270000'),
            longitude=Decimal('-97.740000'),
            radius_miles=Decimal('15'),
        )
        dist_map = organization_distances_within_radius(30.2672, -97.7431, 25)
        self.assertIn(self.mid.id, dist_map)
        self.assertLess(dist_map[self.mid.id], 5)

    def test_nearby_location_hidden_when_provider_radius_too_small(self):
        # ~8 miles away with provider radius 5 → not shown even if customer searches 25
        org = Organization.objects.create(
            name='Tight Co',
            slug='tight-co',
            profile_public=True,
            is_active=True,
        )
        OrganizationLocation.objects.create(
            organization=org,
            name='Primary',
            is_primary=True,
            postal_code='78758',
            latitude=Decimal('30.380000'),
            longitude=Decimal('-97.700000'),
            radius_miles=Decimal('5'),
        )
        dist_map = organization_distances_within_radius(30.2672, -97.7431, 25)
        self.assertNotIn(org.id, dist_map)

    def test_inactive_location_does_not_match_search(self):
        """Only active locations participate in dual-radius search."""
        org = Organization.objects.create(
            name='Inactive Loc Co',
            slug='inactive-loc',
            profile_public=True,
            is_active=True,
        )
        OrganizationLocation.objects.create(
            organization=org,
            name='Closed branch',
            is_primary=True,
            is_active=False,
            postal_code='78701',
            latitude=Decimal('30.267200'),
            longitude=Decimal('-97.743100'),
            radius_miles=Decimal('25'),
        )
        dist_map = organization_distances_within_radius(30.2672, -97.7431, 25)
        self.assertNotIn(org.id, dist_map)


class OrganizationLocationsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner@test.local',
            password='password123',
            full_name='Owner',
            phone='5550000001',
        )
        self.org = Organization.objects.create(
            name='Multi Loc Co',
            slug='multi-loc',
            profile_public=True,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        self.client.force_authenticate(user=self.owner)

    def test_create_second_location(self):
        res1 = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/locations/',
            {
                'name': 'Downtown',
                'city': 'Austin',
                'state': 'TX',
                'postal_code': '78701',
                'latitude': '30.267200',
                'longitude': '-97.743100',
                'radius_miles': 20,
                'is_primary': True,
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res1.status_code, 201, res1.data)
        res2 = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/locations/',
            {
                'name': 'North',
                'city': 'Austin',
                'state': 'TX',
                'postal_code': '78758',
                'latitude': '30.550000',
                'longitude': '-97.700000',
                'radius_miles': 15,
                'is_primary': False,
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res2.status_code, 201, res2.data)
        self.assertEqual(self.org.locations.count(), 2)
        self.org.refresh_from_db()
        self.assertEqual(self.org.service_postal_code, '78701')
        self.assertEqual(self.org.service_city, 'Austin')

    def test_setting_primary_updates_org_service_mirror_fields(self):
        """Marking a location primary copies its pin onto Organization.service_*."""
        res1 = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/locations/',
            {
                'name': 'Downtown',
                'city': 'Austin',
                'state': 'TX',
                'postal_code': '78701',
                'latitude': '30.267200',
                'longitude': '-97.743100',
                'radius_miles': 20,
                'is_primary': True,
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res1.status_code, 201, res1.data)
        res2 = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/locations/',
            {
                'name': 'North',
                'city': 'Austin',
                'state': 'TX',
                'postal_code': '78758',
                'latitude': '30.550000',
                'longitude': '-97.700000',
                'radius_miles': 15,
                'is_primary': False,
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res2.status_code, 201, res2.data)
        north_id = res2.data['id']

        patch = self.client.patch(
            f'/api/v1/organizations/{self.org.slug}/locations/{north_id}/',
            {'is_primary': True},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(patch.status_code, 200, patch.data)
        self.org.refresh_from_db()
        self.assertEqual(self.org.service_postal_code, '78758')
        self.assertEqual(Decimal(self.org.service_latitude), Decimal('30.550000'))
        self.assertEqual(Decimal(self.org.service_longitude), Decimal('-97.700000'))
        self.assertEqual(Decimal(self.org.service_radius_miles), Decimal('15'))
        self.assertEqual(
            self.org.locations.filter(is_primary=True).count(),
            1,
        )
        self.assertTrue(self.org.locations.get(pk=north_id).is_primary)

    def test_cannot_exceed_max_locations_per_organization(self):
        """API rejects creates once OrganizationLocation.MAX_PER_ORGANIZATION is reached."""
        with patch.object(OrganizationLocation, 'MAX_PER_ORGANIZATION', 2):
            for i, postal in enumerate(('78701', '78702')):
                res = self.client.post(
                    f'/api/v1/organizations/{self.org.slug}/locations/',
                    {
                        'name': f'Loc {i}',
                        'city': 'Austin',
                        'state': 'TX',
                        'postal_code': postal,
                        'latitude': f'30.26{i}000',
                        'longitude': '-97.743100',
                        'radius_miles': 10,
                        'is_primary': i == 0,
                    },
                    format='json',
                    HTTP_HOST='localhost',
                )
                self.assertEqual(res.status_code, 201, res.data)

            overflow = self.client.post(
                f'/api/v1/organizations/{self.org.slug}/locations/',
                {
                    'name': 'Too many',
                    'city': 'Austin',
                    'state': 'TX',
                    'postal_code': '78703',
                    'latitude': '30.268000',
                    'longitude': '-97.743100',
                    'radius_miles': 10,
                    'is_primary': False,
                },
                format='json',
                HTTP_HOST='localhost',
            )
            self.assertEqual(overflow.status_code, 400)
            self.assertIn('at most', str(overflow.data).lower())
            self.assertEqual(self.org.locations.count(), 2)
