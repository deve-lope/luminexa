from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from businesses.models import Organization


class ServiceCategory(models.Model):
    """Provider-defined group for catalog services (e.g. Automobile, House work)."""

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='service_categories'
    )
    name = models.CharField(max_length=120)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'name'],
                name='uniq_service_category_name_per_org',
            ),
        ]

    def __str__(self):
        return f'{self.organization.slug}: {self.name}'


class Service(models.Model):
    class PricingType(models.TextChoices):
        FIXED = 'fixed', 'Fixed price'
        RANGE = 'range', 'Price range'
        QUOTE = 'quote', 'Quote on request'

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='services'
    )
    category = models.ForeignKey(
        ServiceCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='services',
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='services/public/', blank=True, null=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    pricing_type = models.CharField(
        max_length=10,
        choices=PricingType.choices,
        default=PricingType.FIXED,
    )
    base_price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.00'))]
    )
    price_max = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Upper bound when pricing_type is range.',
    )
    show_price = models.BooleanField(
        default=True,
        help_text='When off, price is hidden on the public booking profile.',
    )
    allow_request = models.BooleanField(
        default=True,
        help_text='Customers can send a service request for this item.',
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f'{self.organization.slug}: {self.name}'

    def clean(self):
        if self.pricing_type == self.PricingType.RANGE:
            if self.price_max is None:
                raise ValidationError({'price_max': 'Price range requires a maximum amount.'})
            if self.price_max < self.base_price:
                raise ValidationError({'price_max': 'Maximum must be at least the minimum price.'})
        elif self.price_max is not None and self.pricing_type != self.PricingType.RANGE:
            self.price_max = None

    def save(self, *args, **kwargs):
        if self.pricing_type != self.PricingType.RANGE:
            self.price_max = None
        self.full_clean()
        super().save(*args, **kwargs)


class ServiceGalleryImage(models.Model):
    MAX_PER_SERVICE = 5
    MAX_BYTES = 3 * 1024 * 1024

    service = models.ForeignKey(
        Service, on_delete=models.CASCADE, related_name='gallery_images'
    )
    image = models.ImageField(upload_to='services/gallery/')
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.service_id} gallery #{self.pk}'


class WeeklyScheduleBlock(models.Model):
    """Recurring weekly hours (e.g. Mon–Fri 08:00–16:00) used to auto-generate open slots."""

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='weekly_schedule_blocks'
    )
    weekday = models.PositiveSmallIntegerField(
        help_text='0=Monday … 6=Sunday (Python weekday)',
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['weekday', 'start_time']
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'weekday', 'start_time', 'end_time'],
                name='uniq_weekly_block',
            ),
        ]

    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError('end_time must be after start_time.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class ProviderNotification(models.Model):
    class Kind(models.TextChoices):
        FLEXI_NO_SLOTS_NEXT_WEEK = 'flexi_no_slots_next_week', 'No slots open next week'

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='provider_notifications'
    )
    kind = models.CharField(max_length=40, choices=Kind.choices)
    message = models.CharField(max_length=500)
    week_start = models.DateField(null=True, blank=True)
    dismissed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['organization', 'kind', 'week_start'])]


class CustomerServiceInquiry(models.Model):
    """Customer describes what they need when no catalog service fits or before booking."""

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='service_inquiries'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='service_inquiries',
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inquiries',
    )
    service_label = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Short label, e.g. Plumbing, Interior car wash',
    )
    message = models.TextField()
    service_address = models.TextField(blank=True, default='')
    preferred_date = models.DateField(
        null=True,
        blank=True,
        help_text='Customer-preferred date for the job (not a confirmed slot).',
    )
    dismissed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'dismissed_at', '-created_at']),
        ]


class UnavailableBlock(models.Model):
    """Provider-marked time when they are not available (breaks, personal time, etc.)."""

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='unavailable_blocks'
    )
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='unavailable_blocks_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_at']
        indexes = [models.Index(fields=['organization', 'start_at'])]

    def clean(self):
        if self.start_at and self.end_at and self.start_at >= self.end_at:
            raise ValidationError('end_at must be after start_at.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class AvailabilitySlot(models.Model):
    """Open time offered by the provider; customers may request; staff may book directly."""

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        PENDING = 'pending', 'Pending request'
        BOOKED = 'booked', 'Booked'

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='availability_slots'
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name='availability_slots',
        null=True,
        blank=True,
        help_text='When empty, the slot is open for any service.',
    )
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='availability_slots_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_at']
        indexes = [
            models.Index(fields=['organization', 'start_at']),
            models.Index(fields=['organization', 'status', 'start_at']),
        ]

    def clean(self):
        if self.service_id and self.organization_id:
            if self.service.organization_id != self.organization_id:
                raise ValidationError('Service must belong to the same organization.')
        if self.start_at and self.end_at and self.start_at >= self.end_at:
            raise ValidationError('end_at must be after start_at.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.organization.slug} {self.start_at:%Y-%m-%d %H:%M} ({self.status})'


class Booking(models.Model):
    class Status(models.TextChoices):
        REQUESTED = 'requested', 'Requested'
        CONFIRMED = 'confirmed', 'Confirmed'
        IN_PROGRESS = 'in_progress', 'In progress'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    class Source(models.TextChoices):
        PROVIDER_DIRECT = 'provider_direct', 'Booked by provider'
        CUSTOMER_REQUEST = 'customer_request', 'Customer request'

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='bookings'
    )
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name='bookings')
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bookings_as_customer',
    )
    availability_slot = models.OneToOneField(
        AvailabilitySlot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='booking',
    )
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.CUSTOMER_REQUEST,
    )
    booked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings_created_as_staff',
    )
    customer_notes = models.TextField(blank=True)
    service_address = models.TextField(
        blank=True,
        default='',
        help_text='Where the service will take place (customer-provided).',
    )
    reminder_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the 24h reminder email was sent.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_at']
        indexes = [
            models.Index(fields=['organization', 'start_at']),
            models.Index(fields=['customer', '-start_at']),
        ]

    def clean(self):
        if self.service_id and self.organization_id:
            if self.service.organization_id != self.organization_id:
                raise ValidationError('Service must belong to the same organization.')
        if self.start_at and self.end_at and self.start_at >= self.end_at:
            raise ValidationError('end_at must be after start_at.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class ServiceReview(models.Model):
    RATING_MIN = 1
    RATING_MAX = 5

    service = models.ForeignKey(
        Service, on_delete=models.CASCADE, related_name='reviews'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='service_reviews',
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='service_review',
    )
    communication = models.PositiveSmallIntegerField()
    price = models.PositiveSmallIntegerField()
    punctual = models.PositiveSmallIntegerField()
    quality = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['service', 'customer'],
                name='unique_service_review_per_customer',
            ),
        ]

    def clean(self):
        for field in ('communication', 'price', 'punctual', 'quality'):
            value = getattr(self, field, None)
            if value is not None and not (self.RATING_MIN <= value <= self.RATING_MAX):
                raise ValidationError({field: f'Must be between {self.RATING_MIN} and {self.RATING_MAX}.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def average(self):
        return round(
            (self.communication + self.price + self.punctual + self.quality) / 4,
            1,
        )

    def __str__(self):
        return f'Review {self.pk} for service {self.service_id}'


class BookingStatusEvent(models.Model):
    class Action(models.TextChoices):
        CREATED = 'created', 'Created'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'
        CANCELLED = 'cancelled', 'Cancelled'
        COMPLETED = 'completed', 'Completed'
        RESCHEDULED = 'rescheduled', 'Rescheduled'
        NO_SHOW = 'no_show', 'No-show'

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='status_events')
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='booking_status_events',
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    old_status = models.CharField(max_length=20, blank=True, default='')
    new_status = models.CharField(max_length=20, blank=True, default='')
    note = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.booking_id} {self.action}'


class Task(models.Model):
    class Priority(models.IntegerChoices):
        LOW = 1, 'Low'
        NORMAL = 2, 'Normal'
        HIGH = 3, 'High'
        URGENT = 4, 'Urgent'

    class Recurrence(models.TextChoices):
        NONE = 'none', 'One-time'
        DAILY = 'daily', 'Daily'
        WEEKLY = 'weekly', 'Weekly'
        MONTHLY = 'monthly', 'Monthly'

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='tasks'
    )
    job = models.ForeignKey(
        Booking, on_delete=models.CASCADE, null=True, blank=True, related_name='tasks'
    )
    title = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    priority = models.PositiveSmallIntegerField(
        choices=Priority.choices, default=Priority.NORMAL
    )
    due_at = models.DateTimeField(null=True, blank=True)
    recurrence = models.CharField(
        max_length=10,
        choices=Recurrence.choices,
        default=Recurrence.NONE,
    )
    is_done = models.BooleanField(default=False)
    done_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_done', '-priority', 'due_at', 'created_at']
