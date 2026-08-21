from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import DevicePushToken
from jobs.push_services import fcm_enabled, send_push_to_user

User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False, FIREBASE_CREDENTIALS_FILE='', FIREBASE_CREDENTIALS_JSON='')
class DevicePushTokenAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='push@test.local',
            password='password123',
            full_name='Push User',
            phone='5550000999',
        )
        self.client.force_authenticate(user=self.user)

    def test_register_and_replace_token(self):
        res = self.client.post(
            '/accounts/api/push-tokens/',
            {'token': 'a' * 40, 'platform': 'android'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(DevicePushToken.objects.filter(user=self.user).count(), 1)

        other = User.objects.create_user(
            email='other-push@test.local',
            password='password123',
            full_name='Other',
            phone='5550000888',
        )
        DevicePushToken.objects.filter(user=self.user).update(user=other)
        res2 = self.client.post(
            '/accounts/api/push-tokens/',
            {'token': 'a' * 40, 'platform': 'android'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(DevicePushToken.objects.filter(token='a' * 40, user=self.user).count(), 1)
        self.assertFalse(DevicePushToken.objects.filter(user=other).exists())

    def test_delete_token(self):
        DevicePushToken.objects.create(user=self.user, token='b' * 40, platform='android')
        res = self.client.delete(
            '/accounts/api/push-tokens/',
            {'token': 'b' * 40},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(DevicePushToken.objects.count(), 0)

    def test_fcm_disabled_is_noop(self):
        self.assertFalse(fcm_enabled())
        DevicePushToken.objects.create(user=self.user, token='c' * 40)
        self.assertEqual(send_push_to_user(self.user, title='Hi', body='Test'), 0)
