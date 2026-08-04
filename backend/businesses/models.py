import uuid

from django.conf import settings
from django.db import models


class BusinessType(models.Model):
    class LocationKind(models.TextChoices):
        OFFICE = 'office', 'Business office'
        MOBILE = 'mobile', 'Mobile service'

    slug = models.SlugField(max_length=80, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=400, blank=True)
    icon = models.CharField(max_length=16, blank=True, help_text='Emoji or short label')
    location_kind = models.CharField(
        max_length=16,
        choices=LocationKind.choices,
        default=LocationKind.MOBILE,
        help_text='Office types need a fixed business address for billing; mobile types do not.',
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name

    @property
    def requires_business_address(self):
        return self.location_kind == self.LocationKind.OFFICE


class Organization(models.Model):
    class BookingPolicy(models.TextChoices):
        INSTANT = 'instant', 'Open — instant confirmation'
        APPROVAL = 'approval', 'Open — requires approval'
        CLIENTS_ONLY = 'clients_only', 'By invitation only — approved customers'
        QUOTE = 'quote', 'Quote before confirm — price then accept'


    class SchedulingMode(models.TextChoices):
        RECURRING = 'recurring', 'Weekly schedule (auto slots)'
        FLEXI = 'flexi', 'Flexi (open slots manually)'

    name = models.CharField(max_length=200)
    public_ref = models.CharField(
        max_length=16,
        unique=True,
        blank=True,
        default='',
        db_index=True,
        help_text='Customer-facing ID, e.g. pro1, pro2',
    )
    slug = models.SlugField(max_length=80, unique=True, db_index=True)
    tagline = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='orgs/logos/', blank=True, null=True)
    banner = models.ImageField(upload_to='orgs/banners/', blank=True, null=True)
    profile_public = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    booking_policy = models.CharField(
        max_length=20,
        choices=BookingPolicy.choices,
        default=BookingPolicy.APPROVAL,
    )
    cancel_cutoff_hours = models.PositiveIntegerField(
        default=24,
        help_text=(
            'Customers cannot cancel confirmed bookings within this many hours of start. '
            '0 = no cutoff (cancel anytime before start).'
        ),
    )
    concurrent_capacity = models.PositiveIntegerField(
        default=1,
        help_text=(
            'How many customer jobs can overlap on one time slot. '
            'Each open slot can accept this many simultaneous bookings '
            '(e.g. 2 = two appointments in parallel).'
        ),
    )
    scheduling_mode = models.CharField(
        max_length=20,
        choices=SchedulingMode.choices,
        default=SchedulingMode.FLEXI,
    )
    schedule_valid_from = models.DateField(
        null=True,
        blank=True,
        help_text='First date to generate or offer availability',
    )
    schedule_valid_until = models.DateField(
        null=True,
        blank=True,
        help_text='Last date to generate or offer availability',
    )
    timezone = models.CharField(
        max_length=64,
        default='America/New_York',
        help_text='IANA timezone (e.g. America/New_York). Used for schedule hours and slot times.',
    )
    business_types = models.ManyToManyField(
        BusinessType,
        related_name='organizations',
        blank=True,
    )
    service_address = models.CharField(
        max_length=300,
        blank=True,
        default='',
        help_text='Street address or area where services are offered',
    )
    service_city = models.CharField(
        max_length=120,
        blank=True,
        default='',
        db_index=True,
        help_text='City where the business primarily operates',
    )
    service_state = models.CharField(
        max_length=80,
        blank=True,
        default='',
        db_index=True,
        help_text='State / province / region',
    )
    service_postal_code = models.CharField(
        max_length=12,
        blank=True,
        default='',
        db_index=True,
        help_text='PIN / postal code for the primary service area',
    )
    service_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Geocoded from postal code for radius search',
    )
    service_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Geocoded from postal code for radius search',
    )
    service_radius_miles = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        default=25,
        help_text='How far from the map center this provider serves customers',
    )
    # ── Stripe Connect (customer job payments → provider) ──────────────────
    stripe_account_id = models.CharField(max_length=255, blank=True, default='')
    stripe_charges_enabled = models.BooleanField(default=False)
    stripe_payouts_enabled = models.BooleanField(default=False)
    stripe_details_submitted = models.BooleanField(default=False)
    # ── Stripe Billing (provider pays Luminexa subscription) ───────────────
    stripe_customer_id = models.CharField(max_length=255, blank=True, default='')
    stripe_subscription_id = models.CharField(max_length=255, blank=True, default='')
    subscription_status = models.CharField(
        max_length=32,
        blank=True,
        default='none',
        help_text='none | trialing | active | past_due | canceled | unpaid',
    )
    subscription_plan = models.CharField(
        max_length=32,
        blank=True,
        default='free',
        help_text='free | pro_monthly | pro_yearly',
    )
    subscription_current_period_end = models.DateTimeField(null=True, blank=True)
    subscription_source = models.CharField(
        max_length=16,
        blank=True,
        default='none',
        help_text='none | stripe | promo — how Pro access was granted',
    )
    # QuickBooks Online (one-way push of customers / invoices / payments)
    qbo_realm_id = models.CharField(max_length=64, blank=True, default='')
    qbo_access_token = models.TextField(blank=True, default='')
    qbo_refresh_token = models.TextField(blank=True, default='')
    qbo_token_expires_at = models.DateTimeField(null=True, blank=True)
    qbo_connected_at = models.DateTimeField(null=True, blank=True)
    # Provider books / cash collection
    default_labor_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Default hourly labor rate for job costing (optional).',
    )
    invoice_followup_enabled = models.BooleanField(
        default=True,
        help_text='Email customers automatic reminders for unpaid invoices.',
    )
    invoice_followup_days = models.JSONField(
        default=list,
        blank=True,
        help_text='Days after issue to send payment reminders, e.g. [3, 7, 14]. Empty uses defaults.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def requires_business_address(self):
        """True when any selected category is a fixed business office (billing address)."""
        return self.business_types.filter(
            location_kind=BusinessType.LocationKind.OFFICE,
        ).exists()

    def get_timezone(self):
        """Return the org's IANA timezone as a tzinfo, falling back to UTC."""
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            return ZoneInfo(self.timezone or 'UTC')
        except (ZoneInfoNotFoundError, ValueError):
            return ZoneInfo('UTC')

    def primary_location(self):
        """Primary service location, or first active location as fallback."""
        locs = getattr(self, 'locations', None)
        if locs is None:
            return None
        primary = locs.filter(is_active=True, is_primary=True).first()
        if primary:
            return primary
        return locs.filter(is_active=True).order_by('id').first()


class OrganizationLocation(models.Model):
    """
    A physical service area / branch for an organization.
    Search matches customers against any active location.
    Organization.service_* fields mirror the primary location for compatibility.
    """

    MAX_PER_ORGANIZATION = 20

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='locations',
    )
    name = models.CharField(
        max_length=120,
        blank=True,
        default='',
        help_text='Optional label, e.g. Downtown or North branch',
    )
    is_primary = models.BooleanField(
        default=False,
        help_text='Primary location is shown on the storefront and used for billing address defaults.',
    )
    address = models.CharField(max_length=300, blank=True, default='')
    city = models.CharField(max_length=120, blank=True, default='', db_index=True)
    state = models.CharField(max_length=80, blank=True, default='', db_index=True)
    postal_code = models.CharField(max_length=12, blank=True, default='', db_index=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
    )
    radius_miles = models.DecimalField(
        max_digits=5, decimal_places=1, default=25,
        help_text='How far from this pin the business serves customers.',
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_primary', 'sort_order', 'id']
        indexes = [
            models.Index(fields=['organization', 'is_active']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        label = (self.name or '').strip() or (self.city or '').strip() or self.postal_code or 'Location'
        return f'{self.organization.slug}: {label}'


class OrganizationGalleryImage(models.Model):
    MAX_PER_ORGANIZATION = 12
    MAX_BYTES = 3 * 1024 * 1024

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='gallery_images'
    )
    image = models.ImageField(upload_to='orgs/gallery/')
    caption = models.CharField(max_length=200, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.organization.slug} gallery #{self.pk}'


class OrganizationMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = 'owner', 'Owner'
        STAFF = 'staff', 'Staff'
        CUSTOMER = 'customer', 'Customer'

    class CustomerStatus(models.TextChoices):
        PENDING = 'pending', 'Pending approval'
        APPROVED = 'approved', 'Approved'
        BLOCKED = 'blocked', 'Blocked'

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='memberships'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='organization_memberships',
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER,
    )
    customer_status = models.CharField(
        max_length=20,
        choices=CustomerStatus.choices,
        blank=True,
        default='',
    )
    provider_notes = models.TextField(
        blank=True,
        default='',
        help_text='Internal notes about this customer (staff only).',
    )
    qbo_customer_id = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text='QuickBooks Online Customer Id when synced.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'user'],
                name='uniq_org_membership_per_user',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'organization']),
        ]

    @property
    def can_manage_schedule(self):
        return self.role in (self.Role.OWNER, self.Role.STAFF)

    def __str__(self):
        return f'{self.user_id} @ {self.organization.slug} ({self.role})'


class PostalGeocode(models.Model):
    lookup_key = models.CharField(max_length=160, unique=True, db_index=True)
    postal_code = models.CharField(max_length=12, db_index=True)
    city = models.CharField(max_length=120, blank=True, default='')
    state = models.CharField(max_length=80, blank=True, default='')
    country = models.CharField(max_length=80, blank=True, default='')
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    source = models.CharField(max_length=32, default='nominatim')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['postal_code']

    def __str__(self):
        return self.lookup_key


class StaffInvitation(models.Model):
    """Pending staff invite by email; accepted when user signs in with token."""

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='staff_invitations'
    )
    email = models.EmailField()
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='staff_invitations_sent',
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'email'],
                name='uniq_staff_invite_email_per_org',
            ),
        ]

    def __str__(self):
        return f'{self.email} → {self.organization.slug}'


class PromoCode(models.Model):
    """Shared (or limited) redeemable code that grants complimentary Pro for N weeks."""

    code = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text='Stored uppercase. Providers enter case-insensitively.',
    )
    grant_weeks = models.PositiveIntegerField(
        help_text='Weeks of Pro access granted on each successful redemption.',
    )
    valid_from = models.DateTimeField(
        null=True,
        blank=True,
        help_text='If set, code cannot be redeemed before this time.',
    )
    valid_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text='If set, code cannot be redeemed after this time.',
    )
    max_redemptions = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Optional cap on total redemptions. Blank = unlimited.',
    )
    is_active = models.BooleanField(default=True)
    note = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Internal memo for admins.',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='promo_codes_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.code

    @property
    def redemption_count(self):
        return self.redemptions.count()


class PromoRedemption(models.Model):
    """One redemption of a promo code by an organization."""

    promo_code = models.ForeignKey(
        PromoCode,
        on_delete=models.CASCADE,
        related_name='redemptions',
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='promo_redemptions',
    )
    redeemed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='promo_redemptions',
    )
    granted_until = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['promo_code', 'organization'],
                name='uniq_promo_redemption_per_org',
            ),
        ]

    def __str__(self):
        return f'{self.promo_code_id} → {self.organization_id}'
