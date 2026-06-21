import uuid

from django.conf import settings
from django.db import models


class BusinessType(models.Model):
    slug = models.SlugField(max_length=80, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=400, blank=True)
    icon = models.CharField(max_length=16, blank=True, help_text='Emoji or short label')
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class Organization(models.Model):
    class BookingPolicy(models.TextChoices):
        INSTANT = 'instant', 'Open — instant confirmation'
        APPROVAL = 'approval', 'Open — requires approval'
        CLIENTS_ONLY = 'clients_only', 'By invitation only — approved customers'

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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class OrganizationGalleryImage(models.Model):
    MAX_PER_ORGANIZATION = 12

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
