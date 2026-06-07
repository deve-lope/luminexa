from datetime import time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from businesses.models import BusinessType, Organization, OrganizationMembership
from jobs.models import AvailabilitySlot, Booking, Service, WeeklyScheduleBlock
from jobs.scheduling_services import sync_recurring_slots

DEFAULT_BUSINESS_TYPES = (
    ('plumbing', 'Plumbing', 'Pipes, leaks, and fixtures', '🔧', 10),
    ('electrical', 'Electrical', 'Wiring and electrical work', '⚡', 20),
    ('hvac', 'HVAC', 'Heating and cooling', '❄️', 30),
    ('cleaning', 'Cleaning', 'Home and office cleaning', '🧹', 40),
    ('car-wash', 'Car wash', 'Wash, detail, and mobile car care', '🚗', 50),
    ('pet-grooming', 'Pet grooming', 'Grooming and pet care at home or salon', '🐾', 60),
    ('landscaping', 'Landscaping', 'Lawns and outdoor care', '🌿', 70),
    ('handyman', 'Handyman', 'General repairs and small jobs', '🛠️', 80),
    ('painting', 'Painting', 'Interior and exterior painting', '🎨', 90),
)


class Command(BaseCommand):
    help = 'Seed a demo organization, service, and sample booking for local testing.'

    def _ensure_user(self, email, full_name, password, *, is_staff=False, is_superuser=False):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={'full_name': full_name, 'is_staff': is_staff, 'is_superuser': is_superuser},
        )
        if created or not user.has_usable_password():
            user.set_password(password)
            user.full_name = full_name
            user.is_staff = is_staff
            user.is_superuser = is_superuser
            user.is_active = True
            user.save()
        return user

    def _ensure_business_types(self):
        types = {}
        for slug, name, description, icon, sort_order in DEFAULT_BUSINESS_TYPES:
            bt, _ = BusinessType.objects.get_or_create(
                slug=slug,
                defaults={
                    'name': name,
                    'description': description,
                    'icon': icon,
                    'sort_order': sort_order,
                    'is_active': True,
                },
            )
            types[slug] = bt
        return types

    def handle(self, *args, **options):
        demo_password = 'password123'
        business_types = self._ensure_business_types()
        org, _ = Organization.objects.get_or_create(
            slug='demo',
            defaults={
                'name': 'Demo Services Co.',
                'tagline': 'Quality local service, on your schedule.',
                'description': (
                    'Demo business for Luminexa development. We offer reliable local '
                    'service with flexible scheduling and friendly staff.'
                ),
                'profile_public': True,
                'is_active': True,
                'service_address': '123 Main Street',
                'service_city': 'Austin',
                'service_state': 'TX',
                'service_postal_code': '78701',
            },
        )
        org.service_address = org.service_address or '123 Main Street'
        org.service_city = org.service_city or 'Austin'
        org.service_state = org.service_state or 'TX'
        org.service_postal_code = org.service_postal_code or '78701'
        org.business_types.set([business_types['cleaning']])
        from datetime import date as date_cls
        org.scheduling_mode = Organization.SchedulingMode.RECURRING
        org.schedule_valid_from = date_cls.today()
        org.schedule_valid_until = date_cls.today() + timedelta(days=90)
        org.save(update_fields=[
            'scheduling_mode', 'schedule_valid_from', 'schedule_valid_until',
            'service_address', 'service_city', 'service_state', 'service_postal_code',
        ])
        from businesses.location import assign_org_coordinates
        assign_org_coordinates(org)
        for weekday in range(5):
            WeeklyScheduleBlock.objects.get_or_create(
                organization=org,
                weekday=weekday,
                start_time=time(8, 0),
                end_time=time(16, 0),
                defaults={'is_active': True},
            )
        sync_recurring_slots(org)

        admin = self._ensure_user(
            'admin@luminexa.local', 'Platform Admin', demo_password,
            is_staff=True, is_superuser=True,
        )
        provider = self._ensure_user(
            'provider@luminexa.local', 'Demo Provider', demo_password,
        )
        staff = self._ensure_user(
            'staff@luminexa.local', 'Demo Staff', demo_password,
        )
        for user, role in (
            (admin, OrganizationMembership.Role.OWNER),
            (provider, OrganizationMembership.Role.OWNER),
            (staff, OrganizationMembership.Role.STAFF),
        ):
            OrganizationMembership.objects.get_or_create(
                organization=org,
                user=user,
                defaults={'role': role},
            )
        self.stdout.write(f'Owners/staff linked to {org.slug}')

        service, _ = Service.objects.get_or_create(
            organization=org,
            name='Standard visit',
            defaults={
                'description': 'A typical on-site service appointment.',
                'duration_minutes': 60,
                'base_price': Decimal('89.00'),
                'is_active': True,
                'sort_order': 0,
            },
        )

        customer = self._ensure_user(
            'customer@test.local', 'Test Customer', demo_password,
        )
        OrganizationMembership.objects.get_or_create(
            organization=org,
            user=customer,
            defaults={
                'role': OrganizationMembership.Role.CUSTOMER,
                'customer_status': OrganizationMembership.CustomerStatus.APPROVED,
            },
        )

        for day_offset in (1, 2, 3):
            slot_start = timezone.now().replace(
                hour=10, minute=0, second=0, microsecond=0
            ) + timedelta(days=day_offset)
            slot_end = slot_start + timedelta(minutes=service.duration_minutes)
            AvailabilitySlot.objects.get_or_create(
                organization=org,
                service=service,
                start_at=slot_start,
                end_at=slot_end,
                defaults={
                    'status': AvailabilitySlot.Status.OPEN,
                    'created_by': provider,
                },
            )

        start = timezone.now() + timedelta(days=1, hours=2)
        end = start + timedelta(minutes=service.duration_minutes)
        if not Booking.objects.filter(
            organization=org, customer=customer, service=service, status=Booking.Status.CONFIRMED
        ).exists():
            Booking.objects.create(
                organization=org,
                service=service,
                customer=customer,
                start_at=start,
                end_at=end,
                status=Booking.Status.CONFIRMED,
                source=Booking.Source.PROVIDER_DIRECT,
                booked_by=provider,
                customer_notes='Demo booking (provider booked)',
            )

        self.stdout.write(self.style.SUCCESS(
            f'Demo ready: org slug "{org.slug}". Book at /book/{org.slug}'
        ))
        self.stdout.write('Test logins (email / password):')
        self.stdout.write(f'  provider@luminexa.local / {demo_password}  → SPA /provider')
        self.stdout.write(f'  customer@test.local / {demo_password}  → SPA /customer')
        self.stdout.write(f'  admin@luminexa.local / {demo_password}  → Django admin')
        self.stdout.write(f'  staff@luminexa.local / {demo_password}  → SPA /provider')
