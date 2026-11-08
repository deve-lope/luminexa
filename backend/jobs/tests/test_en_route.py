from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from businesses.models import Organization, OrganizationMembership
from jobs.en_route_services import EN_ROUTE_NEARBY_KM, ensure_booking_service_coordinates
from jobs.models import Booking, CustomerNotification, Service


@override_settings(SECURE_SSL_REDIRECT=False)
class EnRouteBookingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.provider = User.objects.create_user(
            email='provider-enroute@test.local',
            password='password123',
            full_name='Provider',
            phone='5550000101',
        )
        self.customer = User.objects.create_user(
            email='customer-enroute@test.local',
            password='password123',
            full_name='Customer',
            phone='5550000102',
        )
        self.org = Organization.objects.create(
            name='En Route Co',
            slug='en-route-co',
            booking_policy=Organization.BookingPolicy.APPROVAL,
            profile_public=True,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.provider,
            role=OrganizationMembership.Role.OWNER,
        )
        self.service = Service.objects.create(
            organization=self.org,
            name='House visit',
            duration_minutes=60,
            base_price='50.00',
            is_active=True,
        )
        start = timezone.now() + timedelta(hours=2)
        self.booking = Booking.objects.create(
            organization=self.org,
            service=self.service,
            customer=self.customer,
            start_at=start,
            end_at=start + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
            source=Booking.Source.PROVIDER_DIRECT,
            service_address='100 Test St, Toronto, ON M5V 2T6',
            service_latitude=Decimal('43.650000'),
            service_longitude=Decimal('-79.380000'),
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    @patch('jobs.push_services.send_push_to_user', return_value=0)
    @patch('jobs.en_route_services.ensure_booking_service_coordinates', return_value=True)
    def test_start_on_my_way_notifies_customer(self, _coords, _push):
        self._auth(self.provider)
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/on-my-way/',
            {'lat': 43.740000, 'lng': -79.380000},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.booking.refresh_from_db()
        self.assertTrue(self.booking.en_route_at)
        self.assertIsNotNone(self.booking.en_route_distance_km)
        self.assertGreater(float(self.booking.en_route_distance_km), EN_ROUTE_NEARBY_KM)
        self.assertTrue(
            CustomerNotification.objects.filter(
                booking=self.booking,
                kind=CustomerNotification.Kind.PROVIDER_EN_ROUTE,
            ).exists()
        )
        self.assertFalse(
            CustomerNotification.objects.filter(
                booking=self.booking,
                kind=CustomerNotification.Kind.PROVIDER_NEARBY,
            ).exists()
        )
        self.assertTrue(res.data['en_route_active'])
        self.assertIsNotNone(res.data['en_route_distance_km'])

    @patch('jobs.push_services.send_push_to_user', return_value=0)
    @patch('jobs.en_route_services.ensure_booking_service_coordinates', return_value=True)
    def test_nearby_push_when_within_5_km(self, _coords, _push):
        self._auth(self.provider)
        start = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/on-my-way/',
            {'lat': 43.740000, 'lng': -79.380000},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(start.status_code, 200)

        self.booking.refresh_from_db()
        self.booking.en_route_updated_at = timezone.now() - timedelta(minutes=5)
        self.booking.save(update_fields=['en_route_updated_at'])

        near = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/on-my-way/location/',
            {'lat': 43.668000, 'lng': -79.380000},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(near.status_code, 200, near.content)
        self.booking.refresh_from_db()
        self.assertLessEqual(float(self.booking.en_route_distance_km), EN_ROUTE_NEARBY_KM)
        self.assertIsNotNone(self.booking.en_route_nearby_notified_at)
        self.assertTrue(
            CustomerNotification.objects.filter(
                booking=self.booking,
                kind=CustomerNotification.Kind.PROVIDER_NEARBY,
            ).exists()
        )

        self.booking.en_route_updated_at = timezone.now() - timedelta(minutes=5)
        self.booking.save(update_fields=['en_route_updated_at'])
        again = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/on-my-way/location/',
            {'lat': 43.655000, 'lng': -79.380000},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(again.status_code, 200)
        self.assertEqual(
            CustomerNotification.objects.filter(
                booking=self.booking,
                kind=CustomerNotification.Kind.PROVIDER_NEARBY,
            ).count(),
            1,
        )

    @patch('jobs.push_services.send_push_to_user', return_value=0)
    @patch('jobs.en_route_services.ensure_booking_service_coordinates', return_value=True)
    def test_start_job_clears_en_route(self, _coords, _push):
        self._auth(self.provider)
        self.client.post(
            f'/api/v1/bookings/{self.booking.id}/on-my-way/',
            {'lat': 43.740000, 'lng': -79.380000},
            format='json',
            HTTP_HOST='localhost',
        )
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/start/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.IN_PROGRESS)
        self.assertIsNone(self.booking.en_route_at)
        self.assertFalse(res.data.get('en_route_active'))

    @patch('jobs.push_services.send_push_to_user', return_value=0)
    @patch('jobs.en_route_services.ensure_booking_service_coordinates', return_value=True)
    def test_stop_sharing(self, _coords, _push):
        self._auth(self.provider)
        self.client.post(
            f'/api/v1/bookings/{self.booking.id}/on-my-way/',
            {'lat': 43.740000, 'lng': -79.380000},
            format='json',
            HTTP_HOST='localhost',
        )
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/on-my-way/stop/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200)
        self.booking.refresh_from_db()
        self.assertIsNone(self.booking.en_route_at)

    def test_customer_cannot_start_en_route(self):
        self._auth(self.customer)
        res = self.client.post(
            f'/api/v1/bookings/{self.booking.id}/on-my-way/',
            {'lat': 43.74, 'lng': -79.38},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertIn(res.status_code, (403, 404))

    @patch('jobs.en_route_services.geocode_freeform_address')
    def test_ensure_coords_geocodes_labeled_address_as_maps_query(self, mock_geocode):
        mock_geocode.return_value = (45.42, -75.69)
        self.booking.service_latitude = None
        self.booking.service_longitude = None
        self.booking.service_address = (
            'Country: Canada\n'
            'Province: Ontario\n'
            'City: Ottawa\n'
            'Address 1: 100 Rideau St\n'
            'Postal code: K1N5W8'
        )
        self.booking.save(
            update_fields=[
                'service_latitude',
                'service_longitude',
                'service_address',
                'updated_at',
            ]
        )
        self.assertTrue(ensure_booking_service_coordinates(self.booking))
        self.booking.refresh_from_db()
        self.assertIsNotNone(self.booking.service_latitude)
        first_query = mock_geocode.call_args_list[0].args[0]
        self.assertNotIn('Address 1:', first_query)
        self.assertIn('100 Rideau St', first_query)
        self.assertIn('Ottawa', first_query)
