"""Create Play Console review logins: password only, never OTP, never Django admin."""

from datetime import date as date_cls, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import User
from accounts.otp import normalize_email
from businesses.location import assign_org_coordinates, ensure_primary_location
from businesses.models import BusinessType, Organization, OrganizationMembership
from jobs.catalog import ensure_org_categories_from_business_types
from jobs.models import AvailabilitySlot, Service, WeeklyScheduleBlock
from jobs.scheduling_services import sync_recurring_slots

DEMO_ORG_SLUG = 'play-store-demo'
DEMO_PHONE = '5550100100'
DEMO_ADDRESS = '100 Queen Street West, Toronto, ON M5H 2N2'
DEMO_CITY = 'Toronto'
DEMO_STATE = 'ON'
DEMO_POSTAL = 'M5H2N2'


class Command(BaseCommand):
    help = (
        'Create or reset Play Console demo accounts (customer + provider). '
        'Password login only; strips Django admin flags.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            type=str,
            required=True,
            help='Shared password for both demo accounts (min 8 characters).',
        )

    def handle(self, *args, **options):
        password = (options['password'] or '').strip()
        if len(password) < 8:
            raise CommandError('Password must be at least 8 characters')

        customer_email = normalize_email(getattr(settings, 'PLAY_STORE_DEMO_CUSTOMER_EMAIL', ''))
        provider_email = normalize_email(getattr(settings, 'PLAY_STORE_DEMO_PROVIDER_EMAIL', ''))
        if not customer_email or not provider_email:
            raise CommandError(
                'PLAY_STORE_DEMO_CUSTOMER_EMAIL and PLAY_STORE_DEMO_PROVIDER_EMAIL must be set'
            )
        if customer_email == provider_email:
            raise CommandError('Customer and provider demo emails must be different')

        org = self._ensure_demo_org()
        provider = self._ensure_user(
            provider_email,
            'Play Store Demo Provider',
            password,
            extra_updates={
                'phone': DEMO_PHONE,
                'default_service_address': DEMO_ADDRESS,
                'address_country': 'Canada',
            },
        )
        customer = self._ensure_user(
            customer_email,
            'Play Store Demo Customer',
            password,
            extra_updates={
                'phone': DEMO_PHONE,
                'default_service_address': DEMO_ADDRESS,
                'address_country': 'Canada',
            },
        )

        self._set_membership(provider, org, OrganizationMembership.Role.OWNER)
        self._set_membership(
            customer,
            org,
            OrganizationMembership.Role.CUSTOMER,
            customer_status=OrganizationMembership.CustomerStatus.APPROVED,
        )
        OrganizationMembership.objects.filter(user=provider).exclude(organization=org).delete()
        OrganizationMembership.objects.filter(user=customer).exclude(organization=org).delete()

        self.stdout.write(self.style.SUCCESS('Play Store demo accounts ready (no admin, password login):'))
        self.stdout.write(f'  customer  {customer.email}')
        self.stdout.write(f'  provider  {provider.email}')
        self.stdout.write(f'  org       {org.slug} ({org.public_ref})')

    def _ensure_user(self, email, full_name, password, *, extra_updates=None):
        extra_updates = extra_updates or {}
        now = timezone.now()
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            user = User.objects.create_user(
                email=email,
                full_name=full_name,
                password=password,
                is_staff=False,
                is_superuser=False,
                is_active=True,
                email_verified=True,
                onboarding_completed_at=now,
                **extra_updates,
            )
            return user
        user.full_name = full_name
        user.is_staff = False
        user.is_superuser = False
        user.is_active = True
        user.email_verified = True
        if user.onboarding_completed_at is None:
            user.onboarding_completed_at = now
        for field, value in extra_updates.items():
            setattr(user, field, value)
        user.set_password(password)
        user.save()
        return user

    def _set_membership(self, user, org, role, **defaults):
        membership, created = OrganizationMembership.objects.get_or_create(
            organization=org,
            user=user,
            defaults={'role': role, **defaults},
        )
        updates = []
        if membership.role != role:
            membership.role = role
            updates.append('role')
        for field, value in defaults.items():
            if getattr(membership, field) != value:
                setattr(membership, field, value)
                updates.append(field)
        if updates:
            membership.save(update_fields=updates)
        return membership

    def _ensure_demo_org(self):
        cleaning = BusinessType.objects.filter(slug='home-cleaning', is_active=True).first()
        if cleaning is None:
            cleaning, _ = BusinessType.objects.get_or_create(
                slug='home-cleaning',
                defaults={
                    'name': 'Home cleaning',
                    'description': 'House cleaning',
                    'icon': '🧹',
                    'sort_order': 30,
                    'location_kind': BusinessType.LocationKind.MOBILE,
                    'is_active': True,
                },
            )
        org, created = Organization.objects.get_or_create(
            slug=DEMO_ORG_SLUG,
            defaults={
                'name': 'Play Store Demo Services',
                'tagline': 'Sandbox business for Google Play review testers.',
                'description': (
                    'Demo provider for Play Console testing. Not a real business. '
                    'Use the demo customer login to book, or this provider login to manage jobs.'
                ),
                'profile_public': True,
                'is_active': True,
                'booking_policy': Organization.BookingPolicy.INSTANT,
                'concurrent_capacity': 2,
                'service_address': DEMO_ADDRESS,
                'service_city': DEMO_CITY,
                'service_state': DEMO_STATE,
                'service_postal_code': DEMO_POSTAL,
                'timezone': 'America/Toronto',
            },
        )
        org.name = 'Play Store Demo Services'
        org.profile_public = True
        org.is_active = True
        org.booking_policy = Organization.BookingPolicy.INSTANT
        org.service_address = org.service_address or DEMO_ADDRESS
        org.service_city = org.service_city or DEMO_CITY
        org.service_state = org.service_state or DEMO_STATE
        org.service_postal_code = org.service_postal_code or DEMO_POSTAL
        org.scheduling_mode = Organization.SchedulingMode.RECURRING
        org.schedule_valid_from = date_cls.today()
        org.schedule_valid_until = date_cls.today() + timedelta(days=90)
        org.save()
        org.business_types.set([cleaning])
        assign_org_coordinates(org)
        ensure_primary_location(org)
        ensure_org_categories_from_business_types(org)
        category = org.service_categories.filter(name=cleaning.name, is_active=True).first()
        service, _ = Service.objects.get_or_create(
            organization=org,
            name='Standard visit',
            defaults={
                'description': 'A typical on-site service appointment for Play review testers.',
                'duration_minutes': 60,
                'base_price': Decimal('49.00'),
                'is_active': True,
                'sort_order': 0,
                'category': category,
            },
        )
        if category and service.category_id != category.id:
            service.category = category
            service.save(update_fields=['category'])
        for weekday in range(5):
            WeeklyScheduleBlock.objects.get_or_create(
                organization=org,
                weekday=weekday,
                start_time=time(8, 0),
                end_time=time(16, 0),
                defaults={'is_active': True},
            )
        sync_recurring_slots(org)
        if created:
            slot_start = timezone.now().replace(
                hour=10, minute=0, second=0, microsecond=0
            ) + timedelta(days=1)
            slot_end = slot_start + timedelta(minutes=service.duration_minutes)
            AvailabilitySlot.objects.get_or_create(
                organization=org,
                service=service,
                start_at=slot_start,
                end_at=slot_end,
                defaults={'status': AvailabilitySlot.Status.OPEN},
            )
        return org
