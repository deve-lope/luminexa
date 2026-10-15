"""M0 snow route foundation: mode, crew role, seed, staff seats unchanged."""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from businesses.models import Organization, OrganizationMembership, StaffInvitation
from jobs.models import Service, ServiceCategory, ServiceRegion
from jobs.permissions import is_org_crew, is_org_staff, is_provider_member
from jobs.snow_seed import seed_snow_organization

User = get_user_model()


@override_settings(STRIPE_ENABLED=False, SECURE_SSL_REDIRECT=False)
class SnowFoundationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='snow-owner@example.com',
            full_name='Snow Owner',
            password='pass12345',
        )
        self.org = Organization.objects.create(
            name='Snow Co',
            slug='snow-co',
            subscription_status='active',
            provider_mode=Organization.ProviderMode.APPOINTMENT,
        )
        OrganizationMembership.objects.create(
            user=self.owner,
            organization=self.org,
            role=OrganizationMembership.Role.OWNER,
        )
        self.client.force_authenticate(self.owner)

    def test_enable_snow_seeds_region_matrix_services(self):
        res = self.client.patch(
            '/api/v1/organizations/snow-co/',
            {'provider_mode': 'property_routes', 'route_vertical': 'snow'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.org.refresh_from_db()
        self.assertEqual(self.org.provider_mode, Organization.ProviderMode.PROPERTY_ROUTES)
        self.assertEqual(self.org.route_vertical, Organization.RouteVertical.SNOW)
        self.assertTrue(self.org.snow_duration_matrix)
        self.assertTrue(
            ServiceRegion.objects.filter(organization=self.org, name='Main').exists()
        )
        self.assertTrue(
            ServiceCategory.objects.filter(
                organization=self.org, name='Snow cleaning'
            ).exists()
        )
        self.assertGreaterEqual(
            Service.objects.filter(
                organization=self.org, name__startswith='Snow —'
            ).count(),
            4,
        )

    def test_switch_back_to_appointment_keeps_seed_data(self):
        seed_snow_organization(self.org)
        region_id = ServiceRegion.objects.get(organization=self.org, name='Main').id
        res = self.client.patch(
            '/api/v1/organizations/snow-co/',
            {'provider_mode': 'appointment'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.org.refresh_from_db()
        self.assertEqual(self.org.provider_mode, Organization.ProviderMode.APPOINTMENT)
        self.assertTrue(ServiceRegion.objects.filter(pk=region_id).exists())

    def test_crew_invite_accept_and_staff_apis_forbidden(self):
        seed_snow_organization(self.org)
        invitee = User.objects.create_user(
            email='crew1@example.com',
            full_name='Crew One',
            password='pass12345',
        )
        res = self.client.post(
            '/api/v1/organizations/snow-co/invite-staff/',
            {'email': 'crew1@example.com', 'role': 'crew'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)
        invite = StaffInvitation.objects.get(
            organization=self.org, email='crew1@example.com'
        )
        self.assertEqual(invite.role, OrganizationMembership.Role.CREW)

        self.client.force_authenticate(invitee)
        accept = self.client.post(
            '/api/v1/accept-staff-invite/',
            {'token': str(invite.token)},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(accept.status_code, 200, accept.data)
        self.assertEqual(accept.data.get('role'), 'crew')
        m = OrganizationMembership.objects.get(user=invitee, organization=self.org)
        self.assertEqual(m.role, OrganizationMembership.Role.CREW)
        self.assertTrue(is_org_crew(invitee, self.org))
        self.assertFalse(is_org_staff(invitee, self.org))
        self.assertTrue(is_provider_member(invitee, self.org))

        # Existing staff gates reject crew (fail closed).
        forbidden = self.client.get(
            '/api/v1/organizations/snow-co/customers/',
            HTTP_HOST='localhost',
        )
        self.assertEqual(forbidden.status_code, 403, forbidden.data)

        bookings = self.client.get(
            '/api/v1/bookings/',
            {'organization': 'snow-co'},
            HTTP_HOST='localhost',
        )
        # Crew is not staff — list is empty or forbidden depending on queryset filter.
        if bookings.status_code == 200:
            data = bookings.data
            results = data.get('results', data) if isinstance(data, dict) else data
            self.assertEqual(len(results), 0)
        else:
            self.assertEqual(bookings.status_code, 403, bookings.data)

    def test_crew_pending_invite_does_not_consume_staff_seat(self):
        seed_snow_organization(self.org)
        for i in range(OrganizationMembership.MAX_STAFF_PER_ORGANIZATION):
            StaffInvitation.objects.create(
                organization=self.org,
                email=f'crew-pending{i}@example.com',
                invited_by=self.owner,
                role=OrganizationMembership.Role.CREW,
            )
        # Staff seats still free — can invite staff.
        res = self.client.post(
            '/api/v1/organizations/snow-co/invite-staff/',
            {'email': 'office@example.com', 'role': 'staff'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 200, res.data)

    def test_appointment_org_staff_cap_unchanged(self):
        for i in range(OrganizationMembership.MAX_STAFF_PER_ORGANIZATION):
            u = User.objects.create_user(
                email=f'staff{i}@example.com',
                full_name=f'Staff {i}',
                password='pass12345',
            )
            OrganizationMembership.objects.create(
                user=u,
                organization=self.org,
                role=OrganizationMembership.Role.STAFF,
            )
        res = self.client.post(
            '/api/v1/organizations/snow-co/invite-staff/',
            {'email': 'fourth@example.com', 'role': 'staff'},
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(res.data.get('code'), 'staff_limit_reached')


@override_settings(STRIPE_ENABLED=False, SECURE_SSL_REDIRECT=False)
class RegisterBusinessSnowOptInTests(TestCase):
    def setUp(self):
        from businesses.models import BusinessType

        self.client = APIClient()
        self.bt = BusinessType.objects.create(
            slug='home-services-test',
            name='Home services test',
            is_active=True,
            location_kind='mobile',
        )

    def test_signup_with_snow_opt_in_seeds(self):
        res = self.client.post(
            '/accounts/api/register/business/',
            {
                'email': 'newsnow@example.com',
                'full_name': 'New Snow',
                'password': 'pass12345',
                'business_name': 'Plow Pros',
                'business_type_slugs': [self.bt.slug],
                'need_route_optimization': True,
                'route_vertical': 'snow',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        self.assertEqual(res.status_code, 201, res.data)
        org = Organization.objects.get(name='Plow Pros')
        self.assertEqual(org.provider_mode, Organization.ProviderMode.PROPERTY_ROUTES)
        self.assertEqual(org.route_vertical, Organization.RouteVertical.SNOW)
        self.assertTrue(
            ServiceRegion.objects.filter(organization=org, name='Main').exists()
        )
