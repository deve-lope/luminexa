from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from businesses.models import BusinessType, Organization, OrganizationMembership

User = get_user_model()


class ExternalWebsiteUrlTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner-website@luminexa.local',
            full_name='Owner',
            password='password123',
        )
        self.org = Organization.objects.create(
            name='Website Org',
            slug='website-org',
            profile_public=True,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        BusinessType.objects.create(slug='cleaning', name='Cleaning')

    def test_owner_can_save_external_website_url(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(
            f'/api/v1/organizations/{self.org.slug}/',
            {'external_website_url': 'example.com'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.external_website_url, 'https://example.com')

    def test_public_storefront_exposes_website_url(self):
        self.org.external_website_url = 'https://my-shop.example'
        self.org.save(update_fields=['external_website_url'])
        res = self.client.get(
            f'/api/v1/public/providers/{self.org.slug}/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            res.data['organization']['external_website_url'],
            'https://my-shop.example',
        )

    def test_rejects_non_http_scheme(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(
            f'/api/v1/organizations/{self.org.slug}/',
            {'external_website_url': 'javascript:alert(1)'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400)
