"""Staff invite seat limits (base plan: max 3 staff, owner separate)."""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from businesses.models import Organization, OrganizationMembership, StaffInvitation

User = get_user_model()


@override_settings(STRIPE_ENABLED=False, SECURE_SSL_REDIRECT=False)
class StaffInviteLimitTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='staff-limit-owner@example.com',
            full_name='Owner',
            password='pass12345',
        )
        self.org = Organization.objects.create(
            name='Staff Limit Org',
            slug='staff-limit-org',
            subscription_status='active',
        )
        OrganizationMembership.objects.create(
            user=self.owner,
            organization=self.org,
            role=OrganizationMembership.Role.OWNER,
        )
        self.client.force_authenticate(self.owner)

    def _add_staff(self, email: str):
        user = User.objects.create_user(
            email=email,
            full_name=email.split('@')[0],
            password='pass12345',
        )
        OrganizationMembership.objects.create(
            user=user,
            organization=self.org,
            role=OrganizationMembership.Role.STAFF,
        )
        return user

    def test_invite_blocked_at_three_staff(self):
        for i in range(OrganizationMembership.MAX_STAFF_PER_ORGANIZATION):
            self._add_staff(f'staff{i}@example.com')
        res = self.client.post(
            '/api/v1/organizations/staff-limit-org/invite-staff/',
            {'email': 'fourth@example.com'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn('3', str(res.data))
        self.assertFalse(
            StaffInvitation.objects.filter(
                organization=self.org, email='fourth@example.com'
            ).exists()
        )

    def test_pending_invites_count_toward_limit(self):
        for i in range(OrganizationMembership.MAX_STAFF_PER_ORGANIZATION):
            StaffInvitation.objects.create(
                organization=self.org,
                email=f'pending{i}@example.com',
                invited_by=self.owner,
            )
        res = self.client.post(
            '/api/v1/organizations/staff-limit-org/invite-staff/',
            {'email': 'one-more@example.com'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400, res.data)

    def test_resend_pending_invite_allowed_at_cap(self):
        for i in range(OrganizationMembership.MAX_STAFF_PER_ORGANIZATION):
            StaffInvitation.objects.create(
                organization=self.org,
                email=f'pending{i}@example.com',
                invited_by=self.owner,
            )
        res = self.client.post(
            '/api/v1/organizations/staff-limit-org/invite-staff/',
            {'email': 'pending0@example.com'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)

    def test_accept_blocked_when_staff_full(self):
        for i in range(OrganizationMembership.MAX_STAFF_PER_ORGANIZATION):
            self._add_staff(f'full{i}@example.com')
        invitee = User.objects.create_user(
            email='late@example.com',
            full_name='Late',
            password='pass12345',
        )
        invite = StaffInvitation.objects.create(
            organization=self.org,
            email='late@example.com',
            invited_by=self.owner,
        )
        self.client.force_authenticate(invitee)
        res = self.client.post(
            '/api/v1/accept-staff-invite/',
            {'token': str(invite.token)},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertFalse(
            OrganizationMembership.objects.filter(
                organization=self.org,
                user=invitee,
                role=OrganizationMembership.Role.STAFF,
            ).exists()
        )

    def test_accept_allowed_under_limit(self):
        invitee = User.objects.create_user(
            email='ok@example.com',
            full_name='Ok',
            password='pass12345',
        )
        invite = StaffInvitation.objects.create(
            organization=self.org,
            email='ok@example.com',
            invited_by=self.owner,
        )
        self.client.force_authenticate(invitee)
        res = self.client.post(
            '/api/v1/accept-staff-invite/',
            {'token': str(invite.token)},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(
            OrganizationMembership.objects.filter(
                organization=self.org,
                user=invitee,
                role=OrganizationMembership.Role.STAFF,
            ).exists()
        )
