"""Seed the public marketing demo provider used by /demo/provider."""

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
from jobs.models import (
    AvailabilitySlot,
    Booking,
    Invoice,
    ProviderNotification,
    Service,
    ServiceRequestMessage,
    Task,
    WeeklyScheduleBlock,
)
from jobs.scheduling_services import sync_recurring_slots

DEMO_ADDRESS = '100 Queen Street, Ottawa, ON K1P 1A1'
DEMO_CITY = 'Ottawa'
DEMO_STATE = 'ON'
DEMO_POSTAL = 'K1P1A1'


class Command(BaseCommand):
    help = (
        'Create or refresh the marketing demo provider org (services, today jobs, '
        'tasks, notifications) for /for-new-providers → /demo/provider.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            type=str,
            default='',
            help='Override MARKETING_DEMO_PASSWORD (min 8 chars).',
        )

    def handle(self, *args, **options):
        password = (options.get('password') or getattr(settings, 'MARKETING_DEMO_PASSWORD', '') or '').strip()
        if len(password) < 8:
            raise CommandError(
                'Set MARKETING_DEMO_PASSWORD (or pass --password) to at least 8 characters.'
            )

        email = normalize_email(getattr(settings, 'MARKETING_DEMO_PROVIDER_EMAIL', ''))
        slug = (getattr(settings, 'MARKETING_DEMO_ORG_SLUG', '') or 'luminexa-demo').strip()
        if not email:
            raise CommandError('MARKETING_DEMO_PROVIDER_EMAIL must be set.')

        org = self._ensure_org(slug)
        provider = self._ensure_user(
            email,
            'Demo Mobile Pro',
            password,
            extra_updates={
                'phone': '6135550100',
                'default_service_address': DEMO_ADDRESS,
                'address_country': 'Canada',
            },
        )
        customer = self._ensure_user(
            'demo.marketing.customer@luminex-a.com',
            'Alex Customer',
            password,
            extra_updates={
                'phone': '6135550199',
                'default_service_address': '200 Elgin Street, Ottawa, ON',
                'address_country': 'Canada',
            },
        )
        customer2 = self._ensure_user(
            'demo.marketing.customer2@luminex-a.com',
            'Sam Neighbour',
            password,
            extra_updates={
                'phone': '6135550188',
                'default_service_address': '50 Rideau Street, Ottawa, ON',
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
        self._set_membership(
            customer2,
            org,
            OrganizationMembership.Role.CUSTOMER,
            customer_status=OrganizationMembership.CustomerStatus.APPROVED,
        )

        services = self._ensure_services(org)
        self._ensure_schedule(org)
        self._seed_bookings_tasks_notifications(org, provider, customer, customer2, services)

        self.stdout.write(self.style.SUCCESS('Marketing demo ready:'))
        self.stdout.write(f'  provider  {provider.email}')
        self.stdout.write(f'  org       {org.slug} ({org.public_ref})')
        self.stdout.write('  login via POST /accounts/api/login/marketing-demo/ (no password in browser)')

    def _ensure_user(self, email, full_name, password, *, extra_updates=None):
        extra_updates = extra_updates or {}
        now = timezone.now()
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return User.objects.create_user(
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
        membership, _ = OrganizationMembership.objects.get_or_create(
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

    def _ensure_org(self, slug):
        from django.db import connection

        from businesses.public_refs import next_organization_public_ref

        auto = BusinessType.objects.filter(slug='auto-vehicles', is_active=True).first()
        if auto is None:
            auto, _ = BusinessType.objects.get_or_create(
                slug='auto-vehicles',
                defaults={
                    'name': 'Auto & vehicles',
                    'description': 'Wash, detailing, tires, mobile auto care',
                    'icon': '🚗',
                    'sort_order': 10,
                    'location_kind': BusinessType.LocationKind.MOBILE,
                    'is_active': True,
                },
            )
        org = Organization.objects.filter(slug=slug).first()
        if org is None:
            description = (
                'Demo business for Luminexa marketing. Not a real crew — explore '
                'Today, services, jobs, and notifications as a provider would.'
            )
            has_provider_mode = False
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'businesses_organization'
                      AND column_name = 'provider_mode'
                    """
                )
                has_provider_mode = cursor.fetchone() is not None

            if has_provider_mode:
                # Live DB has snow-route columns applied outside the current model tree.
                public_ref = next_organization_public_ref()
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO businesses_organization (
                            name, slug, tagline, description, external_website_url,
                            profile_public, is_active, created_at, updated_at,
                            booking_policy, cancel_cutoff_hours, concurrent_capacity,
                            scheduling_mode, timezone,
                            service_address, service_city, service_state, service_postal_code,
                            public_ref, service_radius_miles,
                            stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled,
                            stripe_details_submitted, stripe_customer_id, stripe_subscription_id,
                            subscription_status, subscription_plan, subscription_source,
                            invoice_followup_days, invoice_followup_enabled,
                            qbo_access_token, qbo_realm_id, qbo_refresh_token,
                            referral_rewards_enabled, referral_reward_amount,
                            referral_max_earnings_per_referrer,
                            referral_max_credit_percent_per_job,
                            referral_max_credit_amount_per_job,
                            provider_mode, route_vertical, snow_duration_matrix,
                            snow_extra_crew_seats, snow_late_start_alert_enabled,
                            snow_late_start_alert_minutes, snow_plow_speed_kmh,
                            snow_road_factor, snow_threshold_cm
                        ) VALUES (
                            %s, %s, %s, %s, '',
                            TRUE, TRUE, NOW(), NOW(),
                            'instant', 24, 2,
                            'recurring', 'America/Toronto',
                            %s, %s, %s, %s,
                            %s, 25.0,
                            '', FALSE, FALSE,
                            FALSE, '', '',
                            'trialing', 'pro_monthly', 'promo',
                            '[]'::jsonb, TRUE,
                            '', '', '',
                            FALSE, 0.00,
                            0.00,
                            100.00,
                            0.00,
                            'appointment', '', '{}'::jsonb,
                            0, FALSE,
                            30, 30,
                            1.3, 2.0
                        )
                        """,
                        [
                            'Rideau Mobile Detailing',
                            slug,
                            'Ottawa driveway detailing — book from your phone.',
                            description,
                            DEMO_ADDRESS,
                            DEMO_CITY,
                            DEMO_STATE,
                            DEMO_POSTAL,
                            public_ref,
                        ],
                    )
                org = Organization.objects.get(slug=slug)
            else:
                org = Organization.objects.create(
                    slug=slug,
                    name='Rideau Mobile Detailing',
                    tagline='Ottawa driveway detailing — book from your phone.',
                    description=description,
                    # Not discoverable/bookable by real customers (shared demo owner).
                    profile_public=False,
                    is_active=True,
                    booking_policy=Organization.BookingPolicy.INSTANT,
                    concurrent_capacity=2,
                    service_address=DEMO_ADDRESS,
                    service_city=DEMO_CITY,
                    service_state=DEMO_STATE,
                    service_postal_code=DEMO_POSTAL,
                    timezone='America/Toronto',
                )
        org.name = 'Rideau Mobile Detailing'
        org.tagline = 'Ottawa driveway detailing — book from your phone.'
        # Keep private so marketplace visitors cannot book the shared demo org.
        org.profile_public = False
        org.is_active = True
        org.booking_policy = Organization.BookingPolicy.INSTANT
        org.concurrent_capacity = 2
        org.service_address = DEMO_ADDRESS
        org.service_city = DEMO_CITY
        org.service_state = DEMO_STATE
        org.service_postal_code = DEMO_POSTAL
        org.timezone = 'America/Toronto'
        org.scheduling_mode = Organization.SchedulingMode.RECURRING
        org.schedule_valid_from = date_cls.today()
        org.schedule_valid_until = date_cls.today() + timedelta(days=90)
        org.subscription_status = 'trialing'
        org.subscription_plan = 'pro_monthly'
        org.subscription_source = 'promo'
        org.subscription_current_period_end = timezone.now() + timedelta(days=25)
        org.save()
        org.business_types.set([auto])
        assign_org_coordinates(org)
        ensure_primary_location(org)
        ensure_org_categories_from_business_types(org)
        return org

    def _ensure_services(self, org):
        category = org.service_categories.filter(is_active=True).first()
        specs = [
            ('Exterior wash', 'Driveway exterior wash and dry.', 45, '59.00', 0),
            ('Interior detail', 'Vacuum, wipe-down, glass.', 90, '119.00', 1),
            ('Full detail', 'Exterior + interior package.', 150, '179.00', 2),
            ('Tire shine add-on', 'Tire clean and shine.', 20, '25.00', 3),
        ]
        services = []
        for name, description, duration, price, sort_order in specs:
            service, _ = Service.objects.get_or_create(
                organization=org,
                name=name,
                defaults={
                    'description': description,
                    'duration_minutes': duration,
                    'base_price': Decimal(price),
                    'is_active': True,
                    'sort_order': sort_order,
                    'category': category,
                },
            )
            updates = []
            if service.description != description:
                service.description = description
                updates.append('description')
            if service.duration_minutes != duration:
                service.duration_minutes = duration
                updates.append('duration_minutes')
            if service.base_price != Decimal(price):
                service.base_price = Decimal(price)
                updates.append('base_price')
            if not service.is_active:
                service.is_active = True
                updates.append('is_active')
            if category and service.category_id != category.id:
                service.category = category
                updates.append('category')
            if service.sort_order != sort_order:
                service.sort_order = sort_order
                updates.append('sort_order')
            if updates:
                service.save(update_fields=updates)
            services.append(service)
        return services

    def _ensure_schedule(self, org):
        for weekday in range(6):
            WeeklyScheduleBlock.objects.get_or_create(
                organization=org,
                weekday=weekday,
                start_time=time(8, 0),
                end_time=time(18, 0),
                defaults={'is_active': True},
            )
        sync_recurring_slots(org)

    def _seed_bookings_tasks_notifications(self, org, provider, customer, customer2, services):
        now = timezone.now()
        today_start = now.replace(hour=10, minute=0, second=0, microsecond=0)
        if today_start < now - timedelta(hours=1):
            today_start = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)

        wash, interior, full, _addon = services[0], services[1], services[2], services[3]

        def ensure_booking(*, service, cust, start_at, status, hours=1):
            end_at = start_at + timedelta(hours=hours)
            existing = Booking.objects.filter(
                organization=org,
                service=service,
                customer=cust,
                start_at=start_at,
            ).first()
            if existing:
                if existing.status != status:
                    existing.status = status
                    existing.save(update_fields=['status'])
                return existing
            return Booking.objects.create(
                organization=org,
                service=service,
                customer=cust,
                start_at=start_at,
                end_at=end_at,
                status=status,
                source=Booking.Source.CUSTOMER_REQUEST,
                service_address=cust.default_service_address or DEMO_ADDRESS,
            )

        today_job = ensure_booking(
            service=wash,
            cust=customer,
            start_at=today_start,
            status=Booking.Status.CONFIRMED,
            hours=1,
        )
        ensure_booking(
            service=interior,
            cust=customer2,
            start_at=today_start + timedelta(hours=3),
            status=Booking.Status.CONFIRMED,
            hours=2,
        )
        ensure_booking(
            service=full,
            cust=customer,
            start_at=today_start + timedelta(days=1, hours=2),
            status=Booking.Status.CONFIRMED,
            hours=3,
        )
        ensure_booking(
            service=wash,
            cust=customer2,
            start_at=today_start + timedelta(days=2),
            status=Booking.Status.CONFIRMED,
            hours=1,
        )

        # Past completed jobs + paid invoices → Analytics shows jobs done & money earned.
        completed_specs = [
            (wash, customer, today_start - timedelta(days=2), 1, Decimal('59.00'), 'INV-DEMO-001'),
            (interior, customer2, today_start - timedelta(days=4), 2, Decimal('119.00'), 'INV-DEMO-002'),
            (full, customer, today_start - timedelta(days=6), 3, Decimal('179.00'), 'INV-DEMO-003'),
            (wash, customer2, today_start - timedelta(days=9), 1, Decimal('59.00'), 'INV-DEMO-004'),
        ]
        for service, cust, start_at, hours, amount, inv_number in completed_specs:
            done = ensure_booking(
                service=service,
                cust=cust,
                start_at=start_at,
                status=Booking.Status.COMPLETED,
                hours=hours,
            )
            invoice, created = Invoice.objects.get_or_create(
                booking=done,
                defaults={
                    'number': inv_number,
                    'status': Invoice.Status.PAID,
                    'currency': 'CAD',
                    'pricing_type': 'fixed',
                    'subtotal': amount,
                    'amount': amount,
                    'tax_total': Decimal('0.00'),
                    'description': service.name,
                    'issued_by': provider,
                    'paid_at': start_at + timedelta(hours=hours + 1),
                    'payment_method': 'offline',
                },
            )
            if not created and invoice.status != Invoice.Status.PAID:
                invoice.status = Invoice.Status.PAID
                invoice.amount = amount
                invoice.subtotal = amount
                invoice.paid_at = start_at + timedelta(hours=hours + 1)
                invoice.payment_method = 'offline'
                invoice.save(
                    update_fields=[
                        'status', 'amount', 'subtotal', 'paid_at', 'payment_method',
                    ]
                )

        # Keep a couple of open slots visible on the calendar.
        for offset_hours in (6, 28):
            slot_start = today_start + timedelta(hours=offset_hours)
            slot_end = slot_start + timedelta(minutes=wash.duration_minutes)
            AvailabilitySlot.objects.get_or_create(
                organization=org,
                service=wash,
                start_at=slot_start,
                end_at=slot_end,
                defaults={'status': AvailabilitySlot.Status.OPEN},
            )

        task_titles = (
            'Bring microfiber towels',
            'Text Sam about parking',
            'Order tire shine stock',
        )
        Task.objects.filter(organization=org, title__startswith='[Demo]').delete()
        Task.objects.filter(organization=org, title__in=task_titles).delete()
        Task.objects.create(
            organization=org,
            job=today_job,
            title='Bring microfiber towels',
            notes='Restock before the 10am wash.',
            priority=Task.Priority.HIGH,
            due_at=today_start - timedelta(minutes=30),
            created_by=provider,
        )
        Task.objects.create(
            organization=org,
            title='Text Sam about parking',
            notes='Confirm driveway access for the afternoon interior.',
            priority=Task.Priority.NORMAL,
            due_at=today_start + timedelta(hours=2),
            created_by=provider,
        )
        Task.objects.create(
            organization=org,
            title='Order tire shine stock',
            notes='Running low for weekend jobs.',
            priority=Task.Priority.LOW,
            due_at=today_start + timedelta(days=2),
            created_by=provider,
        )

        # Customer ↔ provider chat threads (Messages tab).
        ServiceRequestMessage.objects.filter(booking__organization=org).delete()
        ServiceRequestMessage.objects.create(
            booking=today_job,
            sender=customer,
            body='Hi — driveway is clear on the left side. Gate code 4421.',
        )
        ServiceRequestMessage.objects.create(
            booking=today_job,
            sender=provider,
            body='Perfect, thanks Alex. See you around 10.',
        )
        later = Booking.objects.filter(
            organization=org,
            service=interior,
            customer=customer2,
            status=Booking.Status.CONFIRMED,
        ).order_by('-start_at').first()
        if later:
            ServiceRequestMessage.objects.create(
                booking=later,
                sender=customer2,
                body='Can you bring the interior vacuum? Kids left crumbs in the back seat.',
            )
            ServiceRequestMessage.objects.create(
                booking=later,
                sender=provider,
                body='Yup — full interior kit is packed. See you this afternoon.',
            )

        notif_msgs = (
            'New booking: Exterior wash with Alex Customer',
            'Task due: Bring microfiber towels',
            'Tip: Share your My page link in Instagram bio',
        )
        ProviderNotification.objects.filter(
            organization=org,
            message__startswith='[Demo]',
        ).delete()
        ProviderNotification.objects.filter(
            organization=org,
            message__in=notif_msgs,
        ).delete()
        ProviderNotification.objects.create(
            organization=org,
            booking=today_job,
            kind=ProviderNotification.Kind.NEW_CUSTOMER_BOOKING,
            message='New booking: Exterior wash with Alex Customer',
            link_path=f'/provider/{org.slug}/schedule/booking/{today_job.id}',
        )
        ProviderNotification.objects.create(
            organization=org,
            kind=ProviderNotification.Kind.TASK_DUE,
            message='Task due: Bring microfiber towels',
            link_path=f'/provider/{org.slug}/tasks',
        )
        ProviderNotification.objects.create(
            organization=org,
            kind=ProviderNotification.Kind.PROMO_OFFER,
            message='Tip: Share your My page link in Instagram bio',
            link_path=f'/provider/{org.slug}/my-page',
        )
