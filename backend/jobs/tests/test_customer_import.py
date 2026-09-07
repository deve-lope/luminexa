import io

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from businesses.models import Organization, OrganizationMembership

User = get_user_model()


class CustomerImportTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner-import@test.local',
            full_name='Owner',
            password='pass12345',
        )
        self.org = Organization.objects.create(
            name='Import Co',
            slug='import-co',
            is_active=True,
            profile_public=True,
            booking_policy=Organization.BookingPolicy.CLIENTS_ONLY,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
        )
        self.client = APIClient()
        token, _ = Token.objects.get_or_create(user=self.owner)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def _csv(self, body: str):
        return io.BytesIO(body.encode('utf-8'))

    def test_import_creates_approved_customers(self):
        raw = self._csv(
            'full_name,email,phone\n'
            'Ada Lovelace,ada@import.test,555-1000\n'
            'Grace Hopper,grace@import.test,555-1001\n'
        )
        preview = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/customers/import/',
            {'file': raw, 'dry_run': '1'},
            format='multipart',
        )
        self.assertEqual(preview.status_code, 200, preview.content)
        self.assertEqual(preview.data['ready_count'], 2)
        self.assertEqual(preview.data['will_create'], 2)
        self.assertTrue(preview.data['can_import'])
        self.assertEqual(
            OrganizationMembership.objects.filter(
                organization=self.org,
                role=OrganizationMembership.Role.CUSTOMER,
            ).count(),
            0,
        )

        raw.seek(0)
        res = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/customers/import/',
            {'file': raw},
            format='multipart',
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['created'], 2)
        self.assertEqual(res.data['linked'], 0)
        memberships = OrganizationMembership.objects.filter(
            organization=self.org,
            role=OrganizationMembership.Role.CUSTOMER,
        )
        self.assertEqual(memberships.count(), 2)
        self.assertTrue(
            all(
                m.customer_status == OrganizationMembership.CustomerStatus.APPROVED
                for m in memberships
            )
        )
        ada = User.objects.get(email='ada@import.test')
        self.assertFalse(ada.has_usable_password())
        self.assertFalse(ada.email_verified)

    def test_import_links_existing_user(self):
        existing = User.objects.create_user(
            email='existing@import.test',
            full_name='',
            password=None,
            phone='',
        )
        raw = self._csv(
            'full_name,email,phone\n'
            'Existing Person,existing@import.test,555-2000\n'
        )
        res = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/customers/import/',
            {'file': raw},
            format='multipart',
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['created'], 0)
        self.assertEqual(res.data['linked'], 1)
        existing.refresh_from_db()
        self.assertEqual(existing.full_name, 'Existing Person')
        self.assertEqual(existing.phone, '555-2000')
        self.assertTrue(
            OrganizationMembership.objects.filter(
                organization=self.org,
                user=existing,
                role=OrganizationMembership.Role.CUSTOMER,
                customer_status=OrganizationMembership.CustomerStatus.APPROVED,
            ).exists()
        )

    def test_import_skips_staff_email(self):
        raw = self._csv(
            'full_name,email,phone\n'
            'Owner Again,owner-import@test.local,555-3000\n'
        )
        preview = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/customers/import/',
            {'file': raw, 'dry_run': '1'},
            format='multipart',
        )
        self.assertEqual(preview.status_code, 200, preview.content)
        self.assertEqual(preview.data['will_skip'], 1)
        self.assertFalse(preview.data['can_import'])
        self.assertIn('fix', preview.data['errors'][0])

        raw.seek(0)
        res = self.client.post(
            f'/api/v1/organizations/{self.org.slug}/customers/import/',
            {'file': raw},
            format='multipart',
        )
        self.assertEqual(res.status_code, 400, res.content)
        self.assertEqual(res.data.get('error_count'), 1)

    def test_import_template_download(self):
        res = self.client.get(
            f'/api/v1/organizations/{self.org.slug}/customers/import-template/',
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'full_name,email,phone', res.content)

    def test_remove_customer_from_client_list(self):
        customer = User.objects.create_user(
            email='remove-me@import.test',
            full_name='Remove Me',
            password=None,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=customer,
            role=OrganizationMembership.Role.CUSTOMER,
            customer_status=OrganizationMembership.CustomerStatus.APPROVED,
        )
        res = self.client.delete(
            f'/api/v1/organizations/{self.org.slug}/customers/{customer.id}/',
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertFalse(
            OrganizationMembership.objects.filter(
                organization=self.org,
                user=customer,
                role=OrganizationMembership.Role.CUSTOMER,
            ).exists()
        )
        self.assertTrue(User.objects.filter(pk=customer.pk).exists())
