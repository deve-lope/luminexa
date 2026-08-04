from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import BusinessType, Organization, OrganizationMembership
from jobs.catalog import (
    business_types_with_service_provider_counts,
    organizations_with_services_for_business_type,
)
from jobs.models import Service, ServiceCategory


class BrowseByServiceCategoryTests(TestCase):
    """Browse tiles list providers only when they have active services in that category."""

    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            email='browse.customer@test.local',
            password='password123',
            full_name='Customer',
            phone='5551000001',
        )
        self.owner = User.objects.create_user(
            email='browse.owner@test.local',
            password='password123',
            full_name='Owner',
            phone='5551000002',
        )
        self.home = BusinessType.objects.create(
            slug='home-cleaning',
            name='Home cleaning',
            sort_order=1,
            is_active=True,
        )
        self.auto = BusinessType.objects.create(
            slug='auto-vehicles',
            name='Auto & vehicles',
            sort_order=2,
            is_active=True,
        )
        self.org = Organization.objects.create(
            name='Demo Services Co',
            slug='demo-services-browse',
            profile_public=True,
            is_active=True,
        )
        self.org.business_types.set([self.home, self.auto])
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        self.home_cat = ServiceCategory.objects.create(
            organization=self.org,
            name='Home cleaning',
            sort_order=1,
            is_active=True,
        )
        self.auto_cat = ServiceCategory.objects.create(
            organization=self.org,
            name='Auto & vehicles',
            sort_order=2,
            is_active=True,
        )
        Service.objects.create(
            organization=self.org,
            category=self.auto_cat,
            name='Oil change',
            duration_minutes=60,
            base_price='49.00',
            is_active=True,
        )

    def test_tagged_org_hidden_without_matching_service(self):
        orgs = list(organizations_with_services_for_business_type(self.home))
        self.assertEqual(orgs, [])

        types = {t.slug: t.provider_count for t in business_types_with_service_provider_counts()}
        self.assertNotIn('home-cleaning', types)
        self.assertEqual(types.get('auto-vehicles'), 1)

    def test_org_appears_after_service_in_category(self):
        Service.objects.create(
            organization=self.org,
            category=self.home_cat,
            name='Deep clean',
            duration_minutes=90,
            base_price='120.00',
            is_active=True,
        )
        orgs = list(organizations_with_services_for_business_type(self.home))
        self.assertEqual([o.slug for o in orgs], [self.org.slug])

        self.client.force_authenticate(user=self.customer)
        res = self.client.get(
            f'/api/v1/business-types/{self.home.slug}/providers/',
            HTTP_HOST='localhost',
            secure=True,
        )
        self.assertEqual(res.status_code, 200, getattr(res, 'data', res.content))
        slugs = [p['slug'] for p in res.data['providers']]
        self.assertEqual(slugs, [self.org.slug])

    def test_types_ordered_by_booking_count(self):
        from datetime import timedelta

        from django.utils import timezone

        from jobs.models import Booking

        Service.objects.create(
            organization=self.org,
            category=self.home_cat,
            name='Deep clean',
            duration_minutes=90,
            base_price='120.00',
            is_active=True,
        )
        oil = Service.objects.get(name='Oil change')
        deep = Service.objects.get(name='Deep clean')
        start = timezone.now() + timedelta(days=1)
        for _ in range(3):
            Booking.objects.create(
                organization=self.org,
                service=oil,
                customer=self.customer,
                start_at=start,
                end_at=start + timedelta(hours=1),
                status=Booking.Status.CONFIRMED,
                source=Booking.Source.CUSTOMER_REQUEST,
            )
        Booking.objects.create(
            organization=self.org,
            service=deep,
            customer=self.customer,
            start_at=start,
            end_at=start + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.CUSTOMER_REQUEST,
        )

        types = business_types_with_service_provider_counts()
        slugs = [t.slug for t in types]
        self.assertEqual(slugs[0], 'auto-vehicles')
        self.assertEqual(types[0].booking_count, 3)
        self.assertIn('home-cleaning', slugs)
        home = next(t for t in types if t.slug == 'home-cleaning')
        self.assertEqual(home.booking_count, 1)
