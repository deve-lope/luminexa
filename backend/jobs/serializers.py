from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from businesses.models import BusinessType, Organization, OrganizationGalleryImage, OrganizationMembership
from businesses.location import assign_org_coordinates, parse_radius_miles, quantize_coordinate
from businesses.postal import validate_postal_code

User = get_user_model()

from .models import (
    AvailabilitySlot,
    Booking,
    BookingStatusEvent,
    CustomerNotification,
    CustomerServiceInquiry,
    Invoice,
    ProviderNotification,
    Service,
    ServiceCategory,
    ServiceGalleryImage,
    ServiceRequestMessage,
    ServiceReview,
    Task,
    UnavailableBlock,
    WeeklyScheduleBlock,
)
from .ratings import aggregate_service_ratings
from .tax_rates import currency_for_organization


def _organization_currency(organization) -> str:
    if not organization:
        return 'CAD'
    return currency_for_organization(organization)


class InvoiceSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()
    provider_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()
    service_name = serializers.SerializerMethodField()
    booking_reference = serializers.SerializerMethodField()
    discount = serializers.SerializerMethodField()
    can_pay_online = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = (
            'id', 'number', 'status', 'currency', 'pricing_type',
            'estimated_amount', 'estimated_max',
            'subtotal', 'amount', 'tax_total', 'tax_lines',
            'tax_country', 'tax_region', 'line_items',
            'description', 'notes', 'issued_at', 'paid_at', 'download_url',
            'provider_name', 'customer_name', 'customer_email',
            'service_name', 'booking_reference', 'discount',
            'payment_method', 'can_pay_online',
        )
        read_only_fields = fields

    def get_download_url(self, obj):
        return f'/api/v1/bookings/{obj.booking_id}/invoice/download/'

    def get_provider_name(self, obj):
        return obj.booking.organization.name if obj.booking_id else ''

    def get_customer_name(self, obj):
        if not obj.booking_id:
            return ''
        customer = obj.booking.customer
        return customer.full_name or customer.email or ''

    def get_customer_email(self, obj):
        if not obj.booking_id:
            return ''
        return obj.booking.customer.email or ''

    def get_service_name(self, obj):
        if obj.description:
            return obj.description
        if obj.booking_id and obj.booking.service_id:
            return obj.booking.service.name
        return 'Service'

    def get_booking_reference(self, obj):
        return f'BK-{obj.booking_id:05d}' if obj.booking_id else ''

    def get_discount(self, obj):
        # Reserved for future discount support; always expose for invoice UI.
        return '0.00'

    def get_can_pay_online(self, obj):
        from django.conf import settings as dj_settings
        from .stripe_services import org_can_accept_card_payments

        if not getattr(dj_settings, 'STRIPE_ENABLED', False):
            return False
        if obj.status != Invoice.Status.ISSUED:
            return False
        if not obj.booking_id:
            return False
        return org_can_accept_card_payments(obj.booking.organization)


class OrganizationSerializer(serializers.ModelSerializer):
    business_type_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=BusinessType.objects.filter(is_active=True),
        source='business_types',
        required=False,
    )

    class Meta:
        model = Organization
        fields = (
            'id', 'name', 'public_ref', 'slug', 'tagline', 'description',
            'logo', 'banner', 'profile_public', 'is_active', 'booking_policy',
            'cancel_cutoff_hours', 'concurrent_capacity',
            'scheduling_mode', 'schedule_valid_from', 'schedule_valid_until',
            'service_address', 'service_city', 'service_state', 'service_postal_code',
            'service_latitude', 'service_longitude', 'service_radius_miles',
            'business_type_ids',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'public_ref', 'created_at', 'updated_at')

    def validate_cancel_cutoff_hours(self, value):
        if value is None:
            return 24
        value = int(value)
        if value < 0 or value > 720:
            raise serializers.ValidationError('Use 0–720 hours (0 = no cutoff).')
        return value

    def validate_concurrent_capacity(self, value):
        if value is None:
            return 1
        value = int(value)
        if value < 1 or value > 50:
            raise serializers.ValidationError('Use 1–50 people working at the same time.')
        return value

    def validate_logo(self, value):
        if not value:
            return value
        from luminexa.uploads import validate_uploaded_image_django
        return validate_uploaded_image_django(value)

    def validate_banner(self, value):
        if not value:
            return value
        from luminexa.uploads import validate_uploaded_image_django
        return validate_uploaded_image_django(value)

    def validate_service_postal_code(self, value):
        if not (value or '').strip():
            return ''
        return validate_postal_code(value)

    def validate_service_radius_miles(self, value):
        return parse_radius_miles(value)

    def validate_service_latitude(self, value):
        if value is None:
            return None
        return quantize_coordinate(value)

    def validate_service_longitude(self, value):
        if value is None:
            return None
        return quantize_coordinate(value)

    def _maybe_geocode(self, instance, validated_data):
        if 'service_latitude' in validated_data and 'service_longitude' in validated_data:
            return
        keys = ('service_postal_code', 'service_city', 'service_state', 'service_address')
        if any(k in validated_data for k in keys):
            assign_org_coordinates(instance)

    def create(self, validated_data):
        instance = super().create(validated_data)
        self._maybe_geocode(instance, validated_data)
        from businesses.location import ensure_primary_location
        ensure_primary_location(instance)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._maybe_geocode(instance, validated_data)
        location_keys = (
            'service_postal_code', 'service_city', 'service_state', 'service_address',
            'service_latitude', 'service_longitude', 'service_radius_miles',
        )
        if any(k in validated_data for k in location_keys):
            from businesses.location import ensure_primary_location
            from businesses.models import OrganizationLocation
            primary = ensure_primary_location(instance)
            if primary:
                primary.address = instance.service_address or ''
                primary.city = instance.service_city or ''
                primary.state = instance.service_state or ''
                primary.postal_code = instance.service_postal_code or ''
                primary.latitude = instance.service_latitude
                primary.longitude = instance.service_longitude
                primary.radius_miles = instance.service_radius_miles or 25
                primary.save()
            elif any([
                instance.service_address, instance.service_city, instance.service_postal_code,
                instance.service_latitude is not None,
            ]):
                OrganizationLocation.objects.create(
                    organization=instance,
                    name='Primary',
                    is_primary=True,
                    address=instance.service_address or '',
                    city=instance.service_city or '',
                    state=instance.service_state or '',
                    postal_code=instance.service_postal_code or '',
                    latitude=instance.service_latitude,
                    longitude=instance.service_longitude,
                    radius_miles=instance.service_radius_miles or 25,
                )
        return instance


class WeeklyScheduleBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyScheduleBlock
        fields = ('id', 'weekday', 'start_time', 'end_time', 'is_active')
        read_only_fields = ('id',)


class ProviderNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderNotification
        fields = ('id', 'kind', 'message', 'week_start', 'created_at')
        read_only_fields = fields


class CustomerNotificationSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(
        source='organization.name', read_only=True, allow_null=True,
    )
    booking_id = serializers.IntegerField(source='booking.id', read_only=True, allow_null=True)

    class Meta:
        model = CustomerNotification
        fields = (
            'id', 'kind', 'title', 'message', 'link_path',
            'organization_name', 'booking_id', 'created_at',
        )
        read_only_fields = fields


class CustomerServiceInquiryCreateSerializer(serializers.Serializer):
    service_id = serializers.IntegerField(required=False, allow_null=True)
    service_label = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    message = serializers.CharField(required=False, allow_blank=True, default='')
    service_address = serializers.CharField(required=False, allow_blank=True, default='')
    preferred_date = serializers.DateField(required=False, allow_null=True)

    def validate_message(self, value):
        return (value or '').strip()

    def validate(self, attrs):
        service_id = attrs.get('service_id')
        if service_id is not None:
            org = self.context.get('organization')
            if not org:
                raise serializers.ValidationError('Organization context required.')
            svc = Service.objects.filter(
                id=service_id, organization=org, is_active=True, allow_request=True,
            ).first()
            if not svc:
                raise serializers.ValidationError({'service_id': 'Service not found.'})
            attrs['service'] = svc
            if not (attrs.get('service_label') or '').strip():
                attrs['service_label'] = svc.name
        return attrs


class CustomerServiceInquirySerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True, allow_null=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_slug = serializers.SlugField(source='organization.slug', read_only=True)
    organization_public_ref = serializers.CharField(source='organization.public_ref', read_only=True)
    reference = serializers.SerializerMethodField()

    class Meta:
        model = CustomerServiceInquiry
        fields = (
            'id', 'reference', 'service', 'service_name', 'service_label', 'message',
            'service_address', 'preferred_date', 'status', 'dismissed_at',
            'organization_name', 'organization_slug', 'organization_public_ref',
            'customer_name', 'customer_email', 'customer_phone', 'created_at',
        )
        read_only_fields = fields

    def get_reference(self, obj):
        return f'SR-{obj.pk:05d}'


class ServiceRequestMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    sender_role = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequestMessage
        fields = (
            'id', 'body', 'sender', 'sender_name', 'sender_role', 'is_mine', 'created_at',
        )
        read_only_fields = fields


class CustomerConversationSummarySerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=('booking', 'inquiry'))
    id = serializers.IntegerField()
    reference = serializers.CharField()
    subject = serializers.CharField()
    organization_name = serializers.CharField()
    organization_slug = serializers.CharField()
    organization_public_ref = serializers.CharField(allow_blank=True)
    last_message_preview = serializers.CharField()
    last_message_at = serializers.DateTimeField()
    last_sender_name = serializers.CharField(allow_blank=True)

    def get_sender_role(self, obj):
        booking = getattr(obj, 'booking', None)
        inquiry = getattr(obj, 'inquiry', None)
        if booking and obj.sender_id == booking.customer_id:
            return 'customer'
        if inquiry and obj.sender_id == inquiry.customer_id:
            return 'customer'
        return 'provider'

    def get_is_mine(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.sender_id == request.user.id


class ProviderServiceRequestListSerializer(serializers.Serializer):
    kind = serializers.CharField()
    id = serializers.IntegerField()
    reference = serializers.CharField()
    title = serializers.CharField()
    customer_name = serializers.CharField()
    customer_email = serializers.EmailField()
    status = serializers.CharField()
    bucket = serializers.CharField()
    start_at = serializers.DateTimeField(allow_null=True)
    preferred_date = serializers.DateField(allow_null=True)
    summary = serializers.CharField(allow_null=True)
    message_count = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    invoice = InvoiceSerializer(allow_null=True, required=False)


class ServiceCategorySerializer(serializers.ModelSerializer):
    organization_slug = serializers.SlugField(source='organization.slug', read_only=True)
    service_count = serializers.SerializerMethodField()

    class Meta:
        model = ServiceCategory
        fields = (
            'id', 'organization', 'organization_slug', 'name',
            'sort_order', 'is_active', 'service_count', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'organization_slug', 'service_count', 'created_at', 'updated_at')

    def get_service_count(self, obj):
        return obj.services.filter(is_active=True).count()


class ServiceSerializer(serializers.ModelSerializer):
    organization_slug = serializers.SlugField(source='organization.slug', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    rating_summary = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = (
            'id', 'organization', 'organization_slug', 'category', 'category_name',
            'name', 'description', 'image',
            'duration_minutes', 'pricing_type', 'base_price', 'price_max',
            'show_price', 'quote_questions', 'allow_request', 'fulfillment_kind',
            'is_active', 'sort_order',
            'currency', 'rating_summary', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'organization_slug', 'category_name', 'currency', 'rating_summary',
            'created_at', 'updated_at',
        )

    def get_currency(self, obj):
        return _organization_currency(obj.organization)

    def get_rating_summary(self, obj):
        return aggregate_service_ratings(obj.reviews.all())

    def validate(self, attrs):
        pricing_type = attrs.get(
            'pricing_type',
            getattr(self.instance, 'pricing_type', Service.PricingType.FIXED),
        )
        base_price = attrs.get('base_price', getattr(self.instance, 'base_price', None))
        price_max = attrs.get('price_max', getattr(self.instance, 'price_max', None))
        if pricing_type == Service.PricingType.RANGE:
            if price_max is None:
                raise serializers.ValidationError(
                    {'price_max': 'Enter the high end of your price range.'}
                )
            if base_price is not None and price_max < base_price:
                raise serializers.ValidationError(
                    {'price_max': 'Maximum must be at least the minimum price.'}
                )
        quote_questions = attrs.get(
            'quote_questions',
            getattr(self.instance, 'quote_questions', None),
        )
        if quote_questions is not None:
            if not isinstance(quote_questions, list):
                raise serializers.ValidationError({
                    'quote_questions': 'Must be a list of question strings.',
                })
            cleaned = []
            for item in quote_questions[:20]:
                if isinstance(item, str):
                    text = item.strip()[:300]
                elif isinstance(item, dict):
                    text = (item.get('question') or item.get('text') or '').strip()[:300]
                else:
                    continue
                if text:
                    cleaned.append(text)
            attrs['quote_questions'] = cleaned
            if pricing_type != Service.PricingType.QUOTE:
                attrs['quote_questions'] = cleaned  # keep templates even if switching later
        category = attrs.get('category', getattr(self.instance, 'category', None))
        org = attrs.get('organization') or getattr(self.instance, 'organization', None)
        if category and org and category.organization_id != org.id:
            raise serializers.ValidationError({'category': 'Category must belong to this business.'})
        return attrs


class UnavailableBlockSerializer(serializers.ModelSerializer):
    organization_slug = serializers.SlugField(source='organization.slug', read_only=True)
    open_slots_removed = serializers.IntegerField(read_only=True, required=False)
    pending_requests_declined = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = UnavailableBlock
        fields = (
            'id', 'organization', 'organization_slug',
            'start_at', 'end_at', 'note', 'created_at',
            'open_slots_removed', 'pending_requests_declined',
        )
        read_only_fields = (
            'id', 'organization_slug', 'created_at',
            'open_slots_removed', 'pending_requests_declined',
        )

    def validate(self, attrs):
        start_at = attrs.get('start_at') or (self.instance.start_at if self.instance else None)
        end_at = attrs.get('end_at') or (self.instance.end_at if self.instance else None)
        org = attrs.get('organization') or (self.instance.organization if self.instance else None)
        if start_at and end_at and start_at >= end_at:
            raise serializers.ValidationError({'end_at': 'End must be after start.'})
        if org and start_at and end_at:
            from .unavailable_services import validate_unavailable_window

            validate_unavailable_window(
                org,
                start_at,
                end_at,
                exclude_block_id=self.instance.pk if self.instance else None,
            )
        return attrs

    def create(self, validated_data):
        from .unavailable_services import apply_unavailable_side_effects

        org = validated_data['organization']
        start_at = validated_data['start_at']
        end_at = validated_data['end_at']
        block = UnavailableBlock.objects.create(**validated_data)
        stats = apply_unavailable_side_effects(org, start_at, end_at)
        block._unavailable_stats = stats
        return block

    def to_representation(self, instance):
        data = super().to_representation(instance)
        stats = getattr(instance, '_unavailable_stats', None)
        if stats:
            data['open_slots_removed'] = stats['open_slots_removed']
            data['pending_requests_declined'] = stats['pending_requests_declined']
        return data


class AvailabilitySlotSerializer(serializers.ModelSerializer):
    service_name = serializers.SerializerMethodField()
    organization_slug = serializers.SlugField(source='organization.slug', read_only=True)
    booking_id = serializers.SerializerMethodField()
    booking_status = serializers.SerializerMethodField()
    capacity = serializers.SerializerMethodField()
    occupied_count = serializers.SerializerMethodField()
    remaining_capacity = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    service_address = serializers.SerializerMethodField()

    class Meta:
        model = AvailabilitySlot
        fields = (
            'id', 'organization', 'organization_slug', 'service', 'service_name',
            'start_at', 'end_at', 'status', 'booking_id', 'booking_status',
            'capacity', 'occupied_count', 'remaining_capacity',
            'customer_name', 'customer_phone', 'service_address',
            'created_by', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'organization_slug', 'service_name', 'status',
            'booking_id', 'booking_status',
            'capacity', 'occupied_count', 'remaining_capacity',
            'customer_name', 'customer_phone',
            'service_address', 'created_by', 'created_at', 'updated_at',
        )
        extra_kwargs = {
            'service': {'required': False, 'allow_null': True},
        }

    def get_service_name(self, obj):
        return obj.service.name if obj.service_id else 'Any service'

    def get_capacity(self, obj):
        return obj.capacity

    def get_occupied_count(self, obj):
        return obj.occupied_count()

    def get_remaining_capacity(self, obj):
        return obj.remaining_capacity()

    def get_booking_id(self, obj):
        b = self._booking(obj)
        return b.id if b else None

    def get_booking_status(self, obj):
        b = self._booking(obj)
        return b.status if b else None

    def _booking(self, obj):
        return obj.primary_booking()

    def _can_see_customer_pii(self, obj):
        """Only org staff may see booking customer details on slots."""
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return False
        from .permissions import is_org_staff
        return is_org_staff(user, obj.organization)

    def get_customer_name(self, obj):
        if not self._can_see_customer_pii(obj):
            return None
        b = self._booking(obj)
        return b.customer.full_name if b else None

    def get_customer_phone(self, obj):
        if not self._can_see_customer_pii(obj):
            return None
        b = self._booking(obj)
        return (b.customer.phone or '') if b else None

    def get_service_address(self, obj):
        if not self._can_see_customer_pii(obj):
            return None
        b = self._booking(obj)
        return (b.service_address or '') if b else None

    def validate(self, attrs):
        org = attrs.get('organization') or (self.instance.organization if self.instance else None)
        service = attrs.get('service') or (self.instance.service if self.instance else None)
        start_at = attrs.get('start_at') or (self.instance.start_at if self.instance else None)
        end_at = attrs.get('end_at') or (self.instance.end_at if self.instance else None)
        if org and service and service.organization_id != org.id:
            raise serializers.ValidationError({'service': 'Service must belong to the organization.'})
        if start_at and end_at and start_at >= end_at:
            raise serializers.ValidationError({'end_at': 'End must be after start.'})
        if start_at and start_at <= timezone.now():
            raise serializers.ValidationError({'start_at': 'Slot must be in the future.'})
        if org and start_at and end_at:
            overlap = AvailabilitySlot.objects.filter(
                organization=org,
                start_at__lt=end_at,
                end_at__gt=start_at,
            ).exclude(status=AvailabilitySlot.Status.BOOKED)
            if self.instance:
                overlap = overlap.exclude(pk=self.instance.pk)
            if overlap.exists():
                raise serializers.ValidationError(
                    'This time overlaps another open or pending slot.'
                )
        return attrs


class BookingStatusEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = BookingStatusEvent
        fields = (
            'id', 'action', 'old_status', 'new_status', 'note',
            'actor_name', 'created_at',
        )

    def get_actor_name(self, obj):
        if not obj.actor_id:
            return 'System'
        return obj.actor.full_name or obj.actor.email


class BookingDetailSerializer(serializers.ModelSerializer):
    """Full booking payload for provider schedule detail views."""

    status_events = BookingStatusEventSerializer(many=True, read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    service_duration_minutes = serializers.IntegerField(source='service.duration_minutes', read_only=True)
    service_base_price = serializers.DecimalField(
        source='service.base_price', max_digits=10, decimal_places=2, read_only=True,
    )
    service_pricing_type = serializers.CharField(source='service.pricing_type', read_only=True)
    service_price_max = serializers.DecimalField(
        source='service.price_max', max_digits=10, decimal_places=2, read_only=True, allow_null=True,
    )
    fulfillment_kind = serializers.CharField(source='service.fulfillment_kind', read_only=True)
    job_location = serializers.SerializerMethodField()
    job_location_label = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_slug = serializers.SlugField(source='organization.slug', read_only=True)
    organization_public_ref = serializers.CharField(source='organization.public_ref', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    slot_id = serializers.IntegerField(source='availability_slot_id', read_only=True, allow_null=True)
    parent_booking_id = serializers.IntegerField(read_only=True, allow_null=True)
    return_visit_id = serializers.SerializerMethodField()
    return_visit_start_at = serializers.SerializerMethodField()
    return_visit_status = serializers.SerializerMethodField()
    invoice = InvoiceSerializer(read_only=True)
    currency = serializers.SerializerMethodField()
    booking_policy = serializers.CharField(source='organization.booking_policy', read_only=True)
    quote_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, allow_null=True)
    quote_message = serializers.CharField(read_only=True)
    quote_questions = serializers.JSONField(read_only=True)
    quoted_at = serializers.DateTimeField(read_only=True, allow_null=True)
    requires_quote = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            'id', 'organization', 'organization_slug', 'organization_public_ref', 'organization_name',
            'service', 'service_name', 'service_duration_minutes', 'service_base_price',
            'service_pricing_type', 'service_price_max', 'fulfillment_kind',
            'job_location', 'job_location_label',
            'customer', 'customer_name', 'customer_email', 'customer_phone',
            'slot_id', 'availability_slot', 'start_at', 'end_at', 'status', 'source',
            'customer_notes', 'service_address', 'status_events',
            'parent_booking_id', 'return_visit_id', 'return_visit_start_at', 'return_visit_status',
            'invoice', 'currency',
            'booking_policy', 'requires_quote', 'quote_amount', 'quote_message',
            'quote_questions', 'quoted_at',
            'created_at', 'updated_at',
        )
        read_only_fields = fields

    def get_currency(self, obj):
        return _organization_currency(obj.organization)

    def get_requires_quote(self, obj):
        from .booking_services import booking_requires_quote

        return booking_requires_quote(obj.organization, obj.service)

    def get_job_location(self, obj):
        return (obj.service_address or '').strip()

    def get_job_location_label(self, obj):
        kind = getattr(obj.service, 'fulfillment_kind', None) if obj.service_id else None
        if kind == Service.FulfillmentKind.SHOP:
            return 'Job location — come to the shop'
        return 'Job location — we come to you'

    def _latest_return_visit(self, obj):
        visits = getattr(obj, '_prefetched_objects_cache', {}).get('return_visits')
        if visits is not None:
            active = [
                v for v in visits
                if v.status in (
                    Booking.Status.REQUESTED,
                    Booking.Status.CONFIRMED,
                    Booking.Status.IN_PROGRESS,
                    Booking.Status.NEEDS_RETURN,
                    Booking.Status.COMPLETED,
                )
            ]
            return active[-1] if active else (visits[-1] if visits else None)
        return (
            obj.return_visits.exclude(status=Booking.Status.CANCELLED)
            .order_by('-start_at')
            .first()
        )

    def get_return_visit_id(self, obj):
        visit = self._latest_return_visit(obj)
        return visit.id if visit else None

    def get_return_visit_start_at(self, obj):
        visit = self._latest_return_visit(obj)
        return visit.start_at if visit else None

    def get_return_visit_status(self, obj):
        visit = self._latest_return_visit(obj)
        return visit.status if visit else None


class BookingSerializer(serializers.ModelSerializer):
    status_events = BookingStatusEventSerializer(many=True, read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    service_duration_minutes = serializers.IntegerField(
        source='service.duration_minutes', read_only=True,
    )
    service_base_price = serializers.DecimalField(
        source='service.base_price', max_digits=10, decimal_places=2, read_only=True,
    )
    service_pricing_type = serializers.CharField(source='service.pricing_type', read_only=True)
    service_price_max = serializers.DecimalField(
        source='service.price_max', max_digits=10, decimal_places=2, read_only=True, allow_null=True,
    )
    fulfillment_kind = serializers.CharField(source='service.fulfillment_kind', read_only=True)
    job_location = serializers.SerializerMethodField()
    job_location_label = serializers.SerializerMethodField()
    cancel_cutoff_hours = serializers.IntegerField(
        source='organization.cancel_cutoff_hours', read_only=True,
    )
    booking_policy = serializers.CharField(source='organization.booking_policy', read_only=True)
    can_customer_cancel = serializers.SerializerMethodField()
    can_customer_reschedule = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_slug = serializers.SlugField(source='organization.slug', read_only=True)
    organization_public_ref = serializers.CharField(source='organization.public_ref', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    reference = serializers.SerializerMethodField()
    parent_booking_id = serializers.IntegerField(read_only=True, allow_null=True)
    invoice = InvoiceSerializer(read_only=True)
    can_rate = serializers.SerializerMethodField()
    my_review = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    slot_id = serializers.PrimaryKeyRelatedField(
        queryset=AvailabilitySlot.objects.all(),
        source='availability_slot',
        write_only=True,
        required=False,
    )
    quote_answers = serializers.JSONField(required=False, write_only=True)
    requires_quote = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            'id', 'reference', 'organization', 'organization_slug', 'organization_public_ref',
            'service', 'service_name', 'service_duration_minutes', 'service_base_price',
            'service_pricing_type', 'service_price_max', 'fulfillment_kind',
            'job_location', 'job_location_label',
            'cancel_cutoff_hours', 'can_customer_cancel', 'can_customer_reschedule',
            'organization_name', 'customer', 'customer_name',
            'customer_email', 'customer_phone',
            'slot_id', 'availability_slot', 'start_at', 'end_at', 'status', 'source',
            'booked_by', 'customer_notes', 'service_address', 'status_events',
            'parent_booking_id', 'invoice', 'can_rate', 'my_review', 'currency',
            'booking_policy', 'requires_quote', 'quote_amount', 'quote_message',
            'quote_questions', 'quoted_at', 'quote_answers',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'reference', 'customer_name', 'customer_email', 'customer_phone',
            'service_name', 'service_duration_minutes', 'service_base_price',
            'service_pricing_type', 'service_price_max', 'fulfillment_kind',
            'job_location', 'job_location_label',
            'cancel_cutoff_hours', 'can_customer_cancel', 'can_customer_reschedule',
            'organization_name', 'organization_slug', 'organization_public_ref',
            'availability_slot', 'source', 'booked_by',
            'parent_booking_id', 'invoice', 'can_rate', 'my_review', 'currency',
            'booking_policy', 'requires_quote', 'quote_amount', 'quote_message',
            'quote_questions', 'quoted_at',
            'status_events', 'created_at', 'updated_at',
        )
        extra_kwargs = {
            'organization': {'required': False},
            'service': {'required': False},
            'start_at': {'required': False},
            'end_at': {'required': False},
            'customer': {'required': False},
        }

    def get_reference(self, obj):
        return f'BK-{obj.pk:05d}'

    def get_requires_quote(self, obj):
        from .booking_services import booking_requires_quote

        return booking_requires_quote(obj.organization, obj.service)

    def get_currency(self, obj):
        return _organization_currency(obj.organization)

    def get_job_location(self, obj):
        return (obj.service_address or '').strip()

    def get_job_location_label(self, obj):
        kind = getattr(obj.service, 'fulfillment_kind', None) if obj.service_id else None
        if kind == Service.FulfillmentKind.SHOP:
            return 'Job location — come to the shop'
        return 'Job location — we come to you'

    def get_can_customer_cancel(self, obj):
        from django.utils import timezone as dj_tz

        if obj.status not in (
            Booking.Status.REQUESTED,
            Booking.Status.QUOTED,
            Booking.Status.CONFIRMED,
        ):
            return False
        if obj.start_at <= dj_tz.now():
            return False
        if obj.status in (Booking.Status.REQUESTED, Booking.Status.QUOTED):
            return True
        cutoff = int(getattr(obj.organization, 'cancel_cutoff_hours', 0) or 0)
        if cutoff <= 0:
            return True
        hours_left = (obj.start_at - dj_tz.now()).total_seconds() / 3600
        return hours_left >= cutoff

    def get_can_customer_reschedule(self, obj):
        from django.utils import timezone as dj_tz

        from .booking_services import customer_is_blocked

        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if user and user.is_authenticated and customer_is_blocked(obj.organization, user):
            return False
        if obj.status not in (
            Booking.Status.REQUESTED,
            Booking.Status.QUOTED,
            Booking.Status.CONFIRMED,
        ):
            return False
        if obj.start_at <= dj_tz.now():
            return False
        if obj.status in (Booking.Status.REQUESTED, Booking.Status.QUOTED):
            return True
        cutoff = int(getattr(obj.organization, 'cancel_cutoff_hours', 0) or 0)
        if cutoff <= 0:
            return True
        hours_left = (obj.start_at - dj_tz.now()).total_seconds() / 3600
        return hours_left >= cutoff

    def _review_for_booking(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return None
        # Prefer review tied to this booking; else any review of this service by customer.
        linked = (
            ServiceReview.objects.filter(booking_id=obj.pk, customer=user)
            .order_by('-created_at')
            .first()
        )
        if linked:
            return linked
        return (
            ServiceReview.objects.filter(service_id=obj.service_id, customer=user)
            .order_by('-created_at')
            .first()
        )

    def get_can_rate(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return False
        if obj.customer_id != user.id:
            return False
        if obj.status != Booking.Status.COMPLETED:
            return False
        from .ratings import customer_can_rate_service
        return customer_can_rate_service(obj.service, user)

    def get_my_review(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated or obj.customer_id != user.id:
            return None
        review = self._review_for_booking(obj)
        if not review:
            return None
        return PublicServiceReviewSerializer(review, context=self.context).data

    def validate(self, attrs):
        slot = attrs.get('availability_slot')
        if not self.instance and slot:
            attrs['organization'] = slot.organization
            book_service = slot.service or attrs.get('service')
            if not book_service:
                raise serializers.ValidationError(
                    {'service': 'Service is required when booking a general open slot.'}
                )
            attrs['service'] = book_service
            attrs['start_at'] = slot.start_at
            attrs['end_at'] = slot.end_at
        org = attrs.get('organization') or (self.instance.organization if self.instance else None)
        service = attrs.get('service') or (self.instance.service if self.instance else None)
        if org and service and service.organization_id != org.id:
            raise serializers.ValidationError({'service': 'Service must belong to the organization.'})
        if not self.instance and not slot and not attrs.get('customer'):
            if not all(attrs.get(f) for f in ('organization', 'service', 'start_at', 'end_at')):
                raise serializers.ValidationError(
                    'Provide slot_id for a customer request, or full booking details for staff.'
                )
        return attrs


class BatchBookingItemSerializer(serializers.Serializer):
    slot_id = serializers.PrimaryKeyRelatedField(queryset=AvailabilitySlot.objects.all())
    service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    customer_notes = serializers.CharField(required=False, allow_blank=True, default='')
    service_address = serializers.CharField(required=False, allow_blank=True, default='')
    quote_answers = serializers.JSONField(required=False)


class BatchBookingSerializer(serializers.Serializer):
    bookings = BatchBookingItemSerializer(many=True, min_length=1, max_length=10)
    customer_notes = serializers.CharField(required=False, allow_blank=True, default='')
    service_address = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_bookings(self, items):
        if len(items) < 1:
            raise serializers.ValidationError('Select at least one service to book.')
        slot_ids = [item['slot_id'].id for item in items]
        if len(slot_ids) != len(set(slot_ids)):
            raise serializers.ValidationError(
                'Each service needs its own time slot. Pick different times.'
            )
        return items


class ProviderBookSerializer(serializers.Serializer):
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all())
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.all())
    customer = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    slot_id = serializers.PrimaryKeyRelatedField(
        queryset=AvailabilitySlot.objects.all(),
        required=False,
        allow_null=True,
    )
    start_at = serializers.DateTimeField(required=False)
    end_at = serializers.DateTimeField(required=False)
    customer_notes = serializers.CharField(required=False, allow_blank=True, default='')
    service_address = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        slot = attrs.get('slot_id')
        if slot:
            attrs['organization'] = slot.organization
            if slot.service_id:
                attrs['service'] = slot.service
            attrs['start_at'] = attrs.get('start_at') or slot.start_at
            attrs['end_at'] = attrs.get('end_at') or slot.end_at
        if not attrs.get('start_at') or not attrs.get('end_at'):
            raise serializers.ValidationError(
                'Provide start_at and end_at, or choose an open slot (slot_id).'
            )
        if attrs['start_at'] >= attrs['end_at']:
            raise serializers.ValidationError({'end_at': 'End must be after start.'})
        org = attrs.get('organization')
        service = attrs.get('service')
        if not service:
            raise serializers.ValidationError({'service': 'Service is required.'})
        if org and service and service.organization_id != org.id:
            raise serializers.ValidationError({'service': 'Service must belong to the organization.'})
        return attrs


class BookingDashboardSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)

    class Meta:
        model = Booking
        fields = (
            'id', 'start_at', 'end_at', 'status', 'source', 'service_name',
            'customer_name', 'customer_email', 'customer_phone', 'customer_notes', 'service_address',
        )


class OrgCustomerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.CharField()
    phone = serializers.CharField(allow_blank=True)
    membership_id = serializers.IntegerField()
    customer_status = serializers.CharField(allow_blank=True)
    cancel_count = serializers.IntegerField(required=False, default=0)
    no_show_count = serializers.IntegerField(required=False, default=0)


class TaskSerializer(serializers.ModelSerializer):
    organization_slug = serializers.SlugField(source='organization.slug', read_only=True)
    job_start_at = serializers.DateTimeField(source='job.start_at', read_only=True)
    job_service_name = serializers.CharField(source='job.service.name', read_only=True)
    job_customer_name = serializers.CharField(source='job.customer.full_name', read_only=True)

    class Meta:
        model = Task
        fields = (
            'id', 'organization', 'organization_slug', 'job', 'job_start_at', 'job_service_name',
            'job_customer_name', 'title', 'notes', 'priority', 'due_at', 'recurrence', 'is_done',
            'done_at', 'created_by', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'organization_slug', 'job_start_at', 'job_service_name', 'job_customer_name',
            'done_at', 'created_by', 'created_at', 'updated_at',
        )

    def validate(self, attrs):
        org = attrs.get('organization') or (self.instance.organization if self.instance else None)
        job = attrs.get('job') if 'job' in attrs else (self.instance.job if self.instance else None)
        recurrence = attrs.get('recurrence') or (
            self.instance.recurrence if self.instance else Task.Recurrence.NONE
        )
        due_at = attrs.get('due_at') if 'due_at' in attrs else (self.instance.due_at if self.instance else None)

        if org and job and job.organization_id != org.id:
            raise serializers.ValidationError({'job': 'This job does not belong to your business.'})
        if job and recurrence != Task.Recurrence.NONE:
            raise serializers.ValidationError(
                {'recurrence': 'Prep tasks for a job are one-time only (complete before you leave).'}
            )
        if recurrence != Task.Recurrence.NONE and not due_at:
            raise serializers.ValidationError(
                {'due_at': 'Set a deadline for recurring tasks.'}
            )
        if job and not due_at:
            attrs['due_at'] = job.start_at
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data.setdefault('created_by', request.user)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'is_done' in validated_data:
            if validated_data['is_done'] and not instance.is_done:
                validated_data['done_at'] = timezone.now()
            elif not validated_data['is_done']:
                validated_data['done_at'] = None
        return super().update(instance, validated_data)


def _absolute_media_url(request, file_field):
    """Return a same-origin media path (e.g. /media/...).

    Absolute URLs break behind the SPA nginx proxy because Django sees Host
    ``localhost`` (no :3000), so browsers request port 80 instead of the app.
    """
    if not file_field or not getattr(file_field, 'url', None):
        return None
    return file_field.url


class PublicGalleryImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationGalleryImage
        fields = ('id', 'image_url', 'caption', 'sort_order')

    def get_image_url(self, obj):
        return _absolute_media_url(self.context.get('request'), obj.image)


class PublicOrganizationReadSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()
    gallery = serializers.SerializerMethodField()
    rating_summary = serializers.SerializerMethodField()
    locations = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = (
            'id', 'name', 'public_ref', 'slug', 'tagline', 'description', 'logo_url', 'banner_url',
            'booking_policy', 'gallery', 'rating_summary',
            'service_address', 'service_city', 'service_state', 'service_postal_code',
            'service_latitude', 'service_longitude', 'service_radius_miles',
            'locations', 'currency',
        )

    def get_currency(self, obj):
        return _organization_currency(obj)

    def get_logo_url(self, obj):
        return _absolute_media_url(self.context.get('request'), obj.logo)

    def get_banner_url(self, obj):
        return _absolute_media_url(self.context.get('request'), obj.banner)

    def get_gallery(self, obj):
        images = obj.gallery_images.all()[: OrganizationGalleryImage.MAX_PER_ORGANIZATION]
        return PublicGalleryImageSerializer(images, many=True, context=self.context).data

    def get_rating_summary(self, obj):
        from .ratings import aggregate_organization_ratings
        return aggregate_organization_ratings(obj)

    def get_locations(self, obj):
        from businesses.serializers import OrganizationLocationSerializer

        locs = obj.locations.filter(is_active=True).order_by('-is_primary', 'sort_order', 'id')
        return OrganizationLocationSerializer(locs, many=True).data


class PublicServiceGalleryImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ServiceGalleryImage
        fields = ('id', 'image_url', 'sort_order')

    def get_image_url(self, obj):
        return _absolute_media_url(self.context.get('request'), obj.image)


class ServiceRatingSummarySerializer(serializers.Serializer):
    count = serializers.IntegerField()
    average = serializers.FloatField(allow_null=True)
    communication = serializers.FloatField(allow_null=True)
    price = serializers.FloatField(allow_null=True)
    punctual = serializers.FloatField(allow_null=True)
    quality = serializers.FloatField(allow_null=True)


class PublicServiceReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    average = serializers.SerializerMethodField()

    class Meta:
        model = ServiceReview
        fields = (
            'id', 'communication', 'price', 'punctual', 'quality',
            'average', 'comment', 'created_at', 'customer_name',
        )
        read_only_fields = fields

    def get_customer_name(self, obj):
        name = obj.customer.get_full_name() or obj.customer.username
        return name.split()[0] if name else 'Customer'

    def get_average(self, obj):
        return obj.average


class ServiceReviewWriteSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = ServiceReview
        fields = ('communication', 'price', 'punctual', 'quality', 'comment', 'booking_id')

    def validate_communication(self, value):
        return self._validate_rating(value, 'communication')

    def validate_price(self, value):
        return self._validate_rating(value, 'price')

    def validate_punctual(self, value):
        return self._validate_rating(value, 'punctual')

    def validate_quality(self, value):
        return self._validate_rating(value, 'quality')

    def _validate_rating(self, value, field):
        if not ServiceReview.RATING_MIN <= value <= ServiceReview.RATING_MAX:
            raise serializers.ValidationError(
                f'Must be between {ServiceReview.RATING_MIN} and {ServiceReview.RATING_MAX}.'
            )
        return value


class PublicServiceReadSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    category_id = serializers.IntegerField(source='category.id', read_only=True, allow_null=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    rating_summary = serializers.SerializerMethodField()
    shop_location = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = (
            'id', 'name', 'description', 'duration_minutes',
            'pricing_type', 'base_price', 'price_max', 'show_price', 'quote_questions',
            'allow_request',
            'fulfillment_kind', 'shop_location',
            'category_id', 'category_name', 'sort_order', 'image_url', 'rating_summary',
            'currency',
        )

    def get_currency(self, obj):
        return _organization_currency(obj.organization)

    def get_image_url(self, obj):
        return _absolute_media_url(self.context.get('request'), obj.image)

    def get_rating_summary(self, obj):
        if hasattr(obj, '_rating_summary'):
            return obj._rating_summary
        return aggregate_service_ratings(obj.reviews.all())

    def get_shop_location(self, obj):
        if obj.fulfillment_kind != Service.FulfillmentKind.SHOP:
            return ''
        from businesses.utils import organization_location_full
        return organization_location_full(obj.organization)


class PublicServiceDetailSerializer(PublicServiceReadSerializer):
    gallery = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    my_review = serializers.SerializerMethodField()
    can_rate = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_slug = serializers.CharField(source='organization.slug', read_only=True)
    organization_public_ref = serializers.CharField(source='organization.public_ref', read_only=True)

    class Meta(PublicServiceReadSerializer.Meta):
        fields = PublicServiceReadSerializer.Meta.fields + (
            'gallery', 'reviews', 'my_review', 'can_rate',
            'organization_name', 'organization_slug', 'organization_public_ref',
        )

    def get_gallery(self, obj):
        images = obj.gallery_images.all()[: ServiceGalleryImage.MAX_PER_SERVICE]
        return PublicServiceGalleryImageSerializer(
            images, many=True, context=self.context
        ).data

    def get_reviews(self, obj):
        reviews = obj.reviews.select_related('customer').all()[:20]
        return PublicServiceReviewSerializer(reviews, many=True, context=self.context).data

    def get_my_review(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return None
        review = obj.reviews.filter(customer=user).first()
        if not review:
            return None
        return PublicServiceReviewSerializer(review, context=self.context).data

    def get_can_rate(self, obj):
        from .ratings import customer_can_rate_service
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return customer_can_rate_service(obj, user)
