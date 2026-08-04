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
        AVERAGE = 'average', 'Typical / average price'
        # Legacy: treat like average for quote + display when base_price is set.
        QUOTE = 'quote', 'Quote on request'

    class FulfillmentKind(models.TextChoices):
        MOBILE = 'mobile', 'Mobile — we come to the customer'
        SHOP = 'shop', 'In-shop — customer comes to us'

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
    quote_questions = models.JSONField(
        default=list,
        blank=True,
        help_text='Template questions for quote-priced services (list of strings). '
                  'Customers answer these when requesting; providers can edit on the quote.',
    )
    allow_request = models.BooleanField(
        default=True,
        help_text='Customers can send a service request for this item.',
    )
    fulfillment_kind = models.CharField(
        max_length=16,
        choices=FulfillmentKind.choices,
        default=FulfillmentKind.MOBILE,
        help_text='Mobile: provider goes to the customer. Shop: customer comes to the business.',
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f'{self.organization.slug}: {self.name}'

    @classmethod
    def pricing_requires_quote(cls, pricing_type):
        """Non-fixed catalog prices always go through quote-before-confirm."""
        return pricing_type in (
            cls.PricingType.RANGE,
            cls.PricingType.AVERAGE,
            cls.PricingType.QUOTE,
        )

    def clean(self):
        if self.pricing_type == self.PricingType.RANGE:
            if self.price_max is None:
                raise ValidationError({'price_max': 'Price range requires a maximum amount.'})
            if self.price_max < self.base_price:
                raise ValidationError({'price_max': 'Maximum must be at least the minimum price.'})
        elif self.price_max is not None and self.pricing_type != self.PricingType.RANGE:
            self.price_max = None

        if self.pricing_type == self.PricingType.AVERAGE:
            if self.base_price is None or self.base_price <= 0:
                raise ValidationError({
                    'base_price': 'Enter a typical price so customers see an estimate.',
                })
        if self.pricing_type in (
            self.PricingType.RANGE,
            self.PricingType.AVERAGE,
            self.PricingType.QUOTE,
        ):
            # Customers should see an indicative price whenever a quote is required.
            self.show_price = True

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
        NEW_CUSTOMER_BOOKING = 'new_customer_booking', 'New customer booking'
        CUSTOMER_CANCELLED_BOOKING = 'customer_cancelled_booking', 'Customer cancelled booking'
        CUSTOMER_RESCHEDULE_REQUEST = 'customer_reschedule_request', 'Customer reschedule request'
        QUOTE_ACCEPTED = 'quote_accepted', 'Quote accepted'
        PAYMENT_RECEIVED = 'payment_received', 'Payment received'
        NEW_MESSAGE = 'new_message', 'New message'

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='provider_notifications'
    )
    booking = models.ForeignKey(
        'Booking',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='provider_notifications',
    )
    inquiry = models.ForeignKey(
        'CustomerServiceInquiry',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='provider_notifications',
    )
    kind = models.CharField(max_length=40, choices=Kind.choices)
    message = models.CharField(max_length=500)
    link_path = models.CharField(max_length=300, blank=True, default='')
    week_start = models.DateField(null=True, blank=True)
    dismissed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['organization', 'kind', 'week_start'])]


class CustomerNotification(models.Model):
    """In-app alerts for customers (booking updates, invoices)."""

    class Kind(models.TextChoices):
        BOOKING_CONFIRMED = 'booking_confirmed', 'Booking confirmed'
        BOOKING_DECLINED = 'booking_declined', 'Booking declined'
        BOOKING_CANCELLED = 'booking_cancelled', 'Booking cancelled'
        BOOKING_RESCHEDULED = 'booking_rescheduled', 'Booking rescheduled'
        BOOKING_TIME_CHANGE = 'booking_time_change', 'Provider proposed a new time'
        BOOKING_COMPLETED = 'booking_completed', 'Booking completed'
        INVOICE_READY = 'invoice_ready', 'Invoice ready'
        PAYMENT_CONFIRMED = 'payment_confirmed', 'Payment confirmed'
        NEW_MESSAGE = 'new_message', 'New message'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='customer_notifications',
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='customer_notifications',
        null=True,
        blank=True,
    )
    booking = models.ForeignKey(
        'Booking',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_notifications',
    )
    inquiry = models.ForeignKey(
        'CustomerServiceInquiry',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_notifications',
    )
    kind = models.CharField(max_length=40, choices=Kind.choices)
    title = models.CharField(max_length=200)
    message = models.CharField(max_length=500)
    link_path = models.CharField(max_length=300, blank=True, default='')
    dismissed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer', 'dismissed_at', '-created_at']),
        ]


class CustomerServiceInquiry(models.Model):
    """Customer describes what they need when no catalog service fits or before booking."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        DECLINED = 'declined', 'Declined'

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
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    dismissed_at = models.DateTimeField(null=True, blank=True)
    customer_messages_read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the customer last opened this inquiry conversation.',
    )
    provider_messages_read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When provider staff last opened this inquiry conversation.',
    )
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

    @property
    def capacity(self):
        """How many simultaneous bookings this slot accepts (from org setting)."""
        return max(1, int(getattr(self.organization, 'concurrent_capacity', 1) or 1))

    def occupying_bookings_qs(self):
        """Active bookings that consume a capacity seat on this slot."""
        return self.bookings.exclude(
            status__in=(
                Booking.Status.CANCELLED,
                Booking.Status.COMPLETED,
            ),
        )

    def _occupying_bookings_list(self):
        """Prefer prefetched bookings when available to avoid N+1 queries."""
        cache = getattr(self, '_prefetched_objects_cache', None)
        if cache is not None and 'bookings' in cache:
            excluded = {Booking.Status.CANCELLED, Booking.Status.COMPLETED}
            return [b for b in self.bookings.all() if b.status not in excluded]
        return list(self.occupying_bookings_qs().select_related('customer').order_by('-id'))

    def occupied_count(self):
        return len(self._occupying_bookings_list())

    def remaining_capacity(self):
        return max(0, self.capacity - self.occupied_count())

    def is_bookable(self):
        return self.remaining_capacity() > 0

    def primary_booking(self):
        """Newest occupying booking (for schedule UI that expects a single booking)."""
        occupying = self._occupying_bookings_list()
        if not occupying:
            return None
        return max(occupying, key=lambda b: b.id)

    def refresh_status(self, *, save=True):
        """
        Derive open / pending / booked from remaining capacity and booking states.
        Slot stays open while seats remain so additional customers can book.
        """
        occupying = list(
            self.occupying_bookings_qs().values_list('status', flat=True)
        )
        remaining = max(0, self.capacity - len(occupying))
        if remaining > 0:
            new_status = self.Status.OPEN
        elif not occupying:
            new_status = self.Status.OPEN
        elif any(
            s in (
                Booking.Status.CONFIRMED,
                Booking.Status.IN_PROGRESS,
                Booking.Status.NEEDS_RETURN,
            )
            for s in occupying
        ):
            new_status = self.Status.BOOKED
        else:
            new_status = self.Status.PENDING

        if self.status != new_status:
            self.status = new_status
            if save:
                self.save(update_fields=['status', 'updated_at'])
        return self.status


class Booking(models.Model):
    class Status(models.TextChoices):
        REQUESTED = 'requested', 'Requested'
        QUOTED = 'quoted', 'Quote sent'
        CONFIRMED = 'confirmed', 'Confirmed'
        IN_PROGRESS = 'in_progress', 'In progress'
        NEEDS_RETURN = 'needs_return', 'Needs return visit'
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
    availability_slot = models.ForeignKey(
        AvailabilitySlot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
        help_text='Time window this booking occupies. Multiple bookings may share a slot up to org capacity.',
    )
    parent_booking = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='return_visits',
        help_text='Original booking when this is a return visit for incomplete work.',
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
    quote_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Provider quote amount awaiting customer acceptance.',
    )
    quote_message = models.TextField(
        blank=True,
        default='',
        help_text='What the quote covers / notes for the customer.',
    )
    quote_questions = models.JSONField(
        default=list,
        blank=True,
        help_text='[{id, question, answer}] questions the provider asks before/with the quote.',
    )
    quoted_at = models.DateTimeField(null=True, blank=True)
    prior_start_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Previous start when the provider proposed a new time (awaiting customer accept).',
    )
    prior_end_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Previous end when the provider proposed a new time.',
    )
    prior_availability_slot = models.ForeignKey(
        AvailabilitySlot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text='Previous slot before a provider-proposed time change.',
    )
    awaiting_customer_acceptance = models.BooleanField(
        default=False,
        help_text='True when the provider proposed a new time (and/or quote) and the customer must accept.',
    )
    customer_messages_read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the customer last opened this booking conversation.',
    )
    provider_messages_read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When provider staff last opened this booking conversation.',
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


class Invoice(models.Model):
    """Shared invoice for a booking — visible to customer and provider."""

    class Status(models.TextChoices):
        ISSUED = 'issued', 'Issued'
        PAID = 'paid', 'Paid'
        VOID = 'void', 'Void'

    booking = models.OneToOneField(
        Booking, on_delete=models.CASCADE, related_name='invoice',
    )
    number = models.CharField(max_length=32, unique=True, db_index=True)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.ISSUED,
    )
    currency = models.CharField(max_length=3, default='CAD')
    # Snapshot of catalog pricing at issue time
    pricing_type = models.CharField(max_length=10, blank=True, default='fixed')
    estimated_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    estimated_max = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    # Pre-tax subtotal (POS line total before tax)
    subtotal = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Amount before tax. Null on legacy invoices.',
    )
    # Final amount charged (subtotal + tax)
    amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    tax_country = models.CharField(max_length=2, blank=True, default='')
    tax_region = models.CharField(
        max_length=8, blank=True, default='',
        help_text='Province/state code used for tax (from business address).',
    )
    tax_total = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    # [{code, name, rate, amount}, ...] — GST/PST/HST or US state tax
    tax_lines = models.JSONField(default=list, blank=True)
    # Extra POS items: [{name, type, brand, quantity, amount}, ...]
    line_items = models.JSONField(
        default=list,
        blank=True,
        help_text='Additional bill lines (parts, materials, etc.).',
    )
    description = models.CharField(max_length=255, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices_issued',
    )
    issued_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    # Stripe Connect payment (customer → provider + platform fee)
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True, default='')
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, default='')
    platform_fee_cents = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Luminexa application fee charged on this payment (cents).',
    )
    payment_method = models.CharField(
        max_length=32,
        blank=True,
        default='',
        help_text='offline | stripe | …',
    )
    payment_reminder_count = models.PositiveSmallIntegerField(default=0)
    last_payment_reminder_at = models.DateTimeField(null=True, blank=True)
    qbo_invoice_id = models.CharField(max_length=64, blank=True, default='')
    qbo_payment_id = models.CharField(max_length=64, blank=True, default='')
    qbo_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issued_at']

    def __str__(self):
        return f'{self.number} ({self.status})'


class JobCostLine(models.Model):
    """Internal job cost (not shown on the customer invoice)."""

    class Kind(models.TextChoices):
        MATERIAL = 'material', 'Material'
        LABOR = 'labor', 'Labor'
        EXPENSE = 'expense', 'Expense'

    booking = models.ForeignKey(
        Booking, on_delete=models.CASCADE, related_name='cost_lines',
    )
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.EXPENSE)
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('1.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
    )
    unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='job_cost_lines_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']

    @property
    def total_cost(self) -> Decimal:
        return (self.quantity * self.unit_cost).quantize(Decimal('0.01'))

    def __str__(self):
        return f'{self.kind}: {self.description} ({self.total_cost})'


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
        QUOTED = 'quoted', 'Quote sent'
        QUOTE_ACCEPTED = 'quote_accepted', 'Quote accepted'
        STARTED = 'started', 'Started'
        COMPLETED = 'completed', 'Completed'
        RESCHEDULED = 'rescheduled', 'Rescheduled'
        NO_SHOW = 'no_show', 'No-show'
        INCOMPLETE = 'incomplete', 'Marked incomplete'
        RETURN_SCHEDULED = 'return_scheduled', 'Return visit scheduled'

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='status_events')
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='booking_status_events',
    )
    action = models.CharField(max_length=24, choices=Action.choices)
    old_status = models.CharField(max_length=20, blank=True, default='')
    new_status = models.CharField(max_length=20, blank=True, default='')
    note = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.booking_id} {self.action}'


class ServiceRequestMessage(models.Model):
    """Thread between provider staff and customer on a booking or custom inquiry."""

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='request_messages',
    )
    inquiry = models.ForeignKey(
        CustomerServiceInquiry,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='request_messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='service_request_messages',
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(booking__isnull=False, inquiry__isnull=True)
                    | models.Q(booking__isnull=True, inquiry__isnull=False)
                ),
                name='service_request_message_one_target',
            ),
        ]

    def clean(self):
        has_booking = bool(self.booking_id)
        has_inquiry = bool(self.inquiry_id)
        if has_booking == has_inquiry:
            raise ValidationError('Message must belong to exactly one booking or inquiry.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


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
