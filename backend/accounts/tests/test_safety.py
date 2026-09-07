from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import ChatBlock, SafetyReport
from businesses.models import Organization, OrganizationMembership
from jobs.message_services import get_or_create_conversation, post_conversation_message
from rest_framework.exceptions import PermissionDenied

User = get_user_model()


class SafetyReportAndChatBlockTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner-safety@test.local',
            full_name='Owner',
            password='pass12345',
        )
        self.customer = User.objects.create_user(
            email='cust-safety@test.local',
            full_name='Customer',
            password='pass12345',
        )
        self.org = Organization.objects.create(
            name='Safety Co',
            slug='safety-co',
            is_active=True,
            profile_public=True,
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
        self.conv = get_or_create_conversation(
            organization=self.org,
            customer=self.customer,
        )
        self.client = APIClient()

    def _auth(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_customer_can_report_organization(self):
        self._auth(self.customer)
        res = self.client.post(
            '/accounts/api/safety/reports/',
            {
                'organization_slug': self.org.slug,
                'reason': 'scam',
                'detail': 'They asked me to pay outside the app and threatened me.',
                'conversation_id': self.conv.id,
            },
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.content)
        report = SafetyReport.objects.get()
        self.assertEqual(report.reporter_id, self.customer.id)
        self.assertEqual(report.reported_organization_id, self.org.id)
        self.assertIsNone(report.reported_user_id)
        self.assertEqual(report.status, SafetyReport.Status.OPEN)
        self.assertTrue(mail.outbox)

    def test_provider_can_report_customer(self):
        self._auth(self.owner)
        res = self.client.post(
            '/accounts/api/safety/reports/',
            {
                'organization_slug': self.org.slug,
                'reported_user_id': self.customer.id,
                'reason': 'harassment',
                'detail': 'Customer sent abusive messages after the booking.',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.content)
        report = SafetyReport.objects.get()
        self.assertEqual(report.reported_user_id, self.customer.id)

    def test_report_requires_detail(self):
        self._auth(self.customer)
        res = self.client.post(
            '/accounts/api/safety/reports/',
            {
                'organization_slug': self.org.slug,
                'reason': 'other',
                'detail': 'too short',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_chat_block_stops_messaging_both_ways(self):
        self._auth(self.customer)
        res = self.client.post(
            '/accounts/api/safety/chat-blocks/',
            {'organization_slug': self.org.slug},
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(
            ChatBlock.objects.filter(
                organization=self.org,
                customer=self.customer,
            ).exists()
        )

        with self.assertRaises(PermissionDenied):
            post_conversation_message(
                conversation=self.conv,
                sender=self.customer,
                body='Hello still?',
            )
        with self.assertRaises(PermissionDenied):
            post_conversation_message(
                conversation=self.conv,
                sender=self.owner,
                body='Provider reply',
            )

        # Conversation messages API surfaces the flag
        res = self.client.get(f'/api/v1/conversations/{self.conv.id}/messages/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['messaging_blocked'])
        self.assertTrue(res.data['blocked_by_me'])

    def test_blocker_can_unblock(self):
        self._auth(self.customer)
        self.client.post(
            '/accounts/api/safety/chat-blocks/',
            {'organization_slug': self.org.slug},
            format='json',
        )
        res = self.client.delete(
            '/accounts/api/safety/chat-blocks/',
            {'organization_slug': self.org.slug},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertFalse(ChatBlock.objects.filter(organization=self.org).exists())
        msg = post_conversation_message(
            conversation=self.conv,
            sender=self.customer,
            body='Unblocked again',
        )
        self.assertTrue(msg.pk)
