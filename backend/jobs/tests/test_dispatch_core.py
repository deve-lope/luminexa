"""Snow dispatch M1–M7 core: seats, properties, optimize, commit, complete, GPS gate."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from businesses.models import Organization, OrganizationMembership, StaffInvitation
from jobs.dispatch_optimizer import solve
from jobs.models import (
    Booking,
    DispatchRoute,
    DispatchRun,
    DispatchRunStop,
    Service,
    ServiceProperty,
    ServiceRegion,
)
from jobs.snow_seed import seed_snow_organization

User = get_user_model()


@override_settings(STRIPE_ENABLED=False, SECURE_SSL_REDIRECT=False)
class DispatchCoreTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='disp-owner@example.com', full_name='Owner', password='pass12345'
        )
        self.crew_user = User.objects.create_user(
            email='disp-crew@example.com', full_name='Crew', password='pass12345'
        )
        self.customer = User.objects.create_user(
            email='disp-cust@example.com', full_name='Cust', password='pass12345'
        )
        self.org = Organization.objects.create(
            name='Disp Snow',
            slug='disp-snow',
            subscription_status='active',
            subscription_plan='snow_monthly',
            service_latitude=Decimal('45.421500'),
            service_longitude=Decimal('-75.697200'),
        )
        OrganizationMembership.objects.create(
            user=self.owner, organization=self.org, role=OrganizationMembership.Role.OWNER
        )
        seed_snow_organization(self.org)
        self.region = ServiceRegion.objects.get(organization=self.org, name='Main')
        self.crew_m = OrganizationMembership.objects.create(
            user=self.crew_user,
            organization=self.org,
            role=OrganizationMembership.Role.CREW,
        )
        OrganizationMembership.objects.create(
            user=self.customer,
            organization=self.org,
            role=OrganizationMembership.Role.CUSTOMER,
            customer_status=OrganizationMembership.CustomerStatus.APPROVED,
        )
        self.client.force_authenticate(self.owner)

    def _prop(self, **kwargs):
        defaults = dict(
            organization=self.org,
            region=self.region,
            customer=self.customer,
            service_address_line1='100 Test St',
            service_city='Ottawa',
            latitude=Decimal('45.430000'),
            longitude=Decimal('-75.690000'),
            frequency=ServiceProperty.Frequency.SEASONAL,
            contract_start=date.today() - timedelta(days=30),
            contract_end=date.today() + timedelta(days=60),
            house_type=ServiceProperty.HouseType.DETACHED,
            work_type=ServiceProperty.WorkType.DRIVEWAY,
        )
        defaults.update(kwargs)
        return ServiceProperty.objects.create(**defaults)

    def test_fourth_crew_blocked_without_extra_seats(self):
        for i in range(2):
            u = User.objects.create_user(
                email=f'crew{i}@ex.com', full_name=f'C{i}', password='pass12345'
            )
            OrganizationMembership.objects.create(
                user=u, organization=self.org, role=OrganizationMembership.Role.CREW
            )
        # 3 crew already (self.crew_m + 2)
        res = self.client.post(
            '/api/v1/organizations/disp-snow/dispatch/crew/',
            {'email': 'fourth@example.com'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(res.data.get('code'), 'crew_limit_reached')

    def test_pending_crew_invite_counts_toward_seats(self):
        StaffInvitation.objects.create(
            organization=self.org,
            email='pend1@example.com',
            role=OrganizationMembership.Role.CREW,
            invited_by=self.owner,
        )
        StaffInvitation.objects.create(
            organization=self.org,
            email='pend2@example.com',
            role=OrganizationMembership.Role.CREW,
            invited_by=self.owner,
        )
        # crew_m + 2 pending = 3
        self.assertEqual(OrganizationMembership.crew_seats_used(self.org), 3)

    def test_master_not_counted_in_crew_seats(self):
        self.assertEqual(OrganizationMembership.crew_count(self.org), 1)
        self.assertEqual(OrganizationMembership.crew_seats_used(self.org), 1)

    def test_optimizer_fallback_and_cap(self):
        stops = [
            {'id': i, 'lat': 45.42 + i * 0.01, 'lng': -75.69, 'service_min': 10}
            for i in range(5)
        ]
        result = solve((45.42, -75.69), stops, vehicles=2, time_limit_s=2)
        self.assertEqual(len(result['routes']), 2)
        self.assertIn(result['solver'], ('ortools', 'fallback'))
        with self.assertRaises(ValueError):
            solve((45.42, -75.69), [{'id': i, 'lat': 45.4, 'lng': -75.6, 'service_min': 5} for i in range(121)])

    def test_commit_creates_zero_bookings_for_seasonal(self):
        p1 = self._prop(service_address_line1='1 A St', latitude=Decimal('45.431'), longitude=Decimal('-75.691'))
        p2 = self._prop(service_address_line1='2 B St', latitude=Decimal('45.432'), longitude=Decimal('-75.692'))
        start = timezone.now() + timedelta(hours=2)
        res = self.client.post(
            '/api/v1/organizations/disp-snow/dispatch/runs/',
            {
                'region_id': self.region.id,
                'scheduled_start': start.isoformat(),
                'crew_membership_ids': [self.crew_m.id],
                'include_seasonal': True,
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        run_id = res.data['id']
        before = Booking.objects.count()
        commit = self.client.post(
            f'/api/v1/organizations/disp-snow/dispatch/runs/{run_id}/commit/',
            {},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(commit.status_code, 200, commit.data)
        self.assertEqual(Booking.objects.count(), before)
        run = DispatchRun.objects.get(pk=run_id)
        self.assertEqual(run.status, DispatchRun.Status.SCHEDULED)
        self.assertGreaterEqual(run.stops.count(), 2)
        self.assertTrue(p1.id and p2.id)

    def test_contract_status_boundaries(self):
        today = date.today()
        live = self._prop(contract_end=today + timedelta(days=14))
        expiring = self._prop(
            service_address_line1='exp',
            contract_end=today + timedelta(days=5),
            latitude=Decimal('45.44'),
            longitude=Decimal('-75.70'),
        )
        expired = self._prop(
            service_address_line1='old',
            contract_end=today - timedelta(days=1),
            latitude=Decimal('45.45'),
            longitude=Decimal('-75.71'),
        )
        upcoming = self._prop(
            service_address_line1='soon',
            contract_start=today + timedelta(days=10),
            contract_end=today + timedelta(days=100),
            latitude=Decimal('45.46'),
            longitude=Decimal('-75.72'),
        )
        self.assertEqual(live.contract_status(today), 'live')
        self.assertEqual(expiring.contract_status(today), 'expiring')
        self.assertEqual(expired.contract_status(today), 'expired')
        self.assertEqual(upcoming.contract_status(today), 'upcoming')

    def test_crew_complete_seasonal_no_invoice_and_gps_gate(self):
        prop = self._prop()
        start = timezone.now() - timedelta(minutes=5)
        run = DispatchRun.objects.create(
            organization=self.org,
            region=self.region,
            run_date=start.date(),
            scheduled_start=start,
            status=DispatchRun.Status.SCHEDULED,
            created_by=self.owner,
            committed_at=timezone.now(),
        )
        route = DispatchRoute.objects.create(
            run=run, crew_membership=self.crew_m, vehicle_index=0
        )
        stop = DispatchRunStop.objects.create(
            run=run,
            route=route,
            sequence=0,
            property=prop,
            customer=self.customer,
            kind=DispatchRunStop.Kind.SEASONAL,
            work_type='driveway',
            house_type='detached',
            service_minutes=10,
            address_line1=prop.service_address_line1,
            latitude=prop.latitude,
            longitude=prop.longitude,
            eta_at=start,
        )
        self.client.force_authenticate(self.crew_user)
        start_res = self.client.post(
            f'/api/v1/organizations/disp-snow/dispatch/routes/{route.id}/start/',
            {},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(start_res.status_code, 200, start_res.data)
        # Far GPS → public null
        route.last_latitude = Decimal('45.50')
        route.last_longitude = Decimal('-75.50')
        route.last_ping_at = timezone.now()
        route.status = DispatchRoute.Status.IN_PROGRESS
        route.save()
        pub = self.client.get(
            f'/api/v1/public/snow-stops/{stop.customer_view_token}/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(pub.status_code, 200)
        self.assertIsNone(pub.data.get('crew_location'))

        # Near GPS → included
        route.last_latitude = Decimal('45.4305')
        route.last_longitude = Decimal('-75.6905')
        route.save()
        pub2 = self.client.get(
            f'/api/v1/public/snow-stops/{stop.customer_view_token}/',
            HTTP_HOST='localhost',
        )
        self.assertIsNotNone(pub2.data.get('crew_location'))

        before_bookings = Booking.objects.count()
        done = self.client.post(
            f'/api/v1/organizations/disp-snow/dispatch/stops/{stop.id}/done/',
            {},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(done.status_code, 200, done.data)
        self.assertEqual(Booking.objects.count(), before_bookings)
        stop.refresh_from_db()
        self.assertEqual(stop.status, DispatchRunStop.Status.DONE)
