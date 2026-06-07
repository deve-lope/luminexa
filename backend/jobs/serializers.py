from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from businesses.models import BusinessType, Organization, OrganizationGalleryImage, OrganizationMembership
from businesses.location import assign_org_coordinates
from businesses.postal import validate_postal_code

User = get_user_model()

from .models import (
    AvailabilitySlot,
    Booking,
    BookingStatusEvent,
    CustomerServiceInquiry,
    ProviderNotification,
    Service,
    ServiceCategory,
    ServiceGalleryImage,
    ServiceReview,
    Task,
    UnavailableBlock,
    WeeklyScheduleBlock,
)
from .ratings import aggregate_service_ratings


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
            'id', 'name', 'slug', 'tagline', 'description',
            'logo', 'banner', 'profile_public', 'is_active', 'booking_policy',
            'scheduling_mode', 'schedule_valid_from', 'schedule_valid_until',
            'service_address', 'service_city', 'service_state', 'service_postal_code',
            'business_type_ids',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_service_postal_code(self, value):
        if not (value or '').strip():
            return ''
        return validate_postal_code(value)

    def _maybe_geocode(self, instance, validated_data):
        keys = ('service_postal_code', 'service_city', 'service_state', 'service_address')
        if any(k in validated_data for k in keys):
            assign_org_coordinates(instance)

    def create(self, validated_data):
        instance = super().create(validated_data)
        self._maybe_geocode(instance, validated_data)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._maybe_geocode(instance, validated_data)
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


class CustomerServiceInquiryCreateSerializer(serializers.Serializer):
    service_id = serializers.IntegerField(required=False, allow_null=True)
    service_label = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    message = serializers.CharField()
    service_address = serializers.CharField(required=False, allow_blank=True, default='')
    preferred_date = serializers.DateField(required=False, allow_null=True)

    def validate_message(self, value):
        text = (value or '').strip()
        if len(text) < 10:
            raise serializers.ValidationError(
                'Please describe what you need in at least 10 characters.'
            )
        return text

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

    class Meta:
        model = CustomerServiceInquiry
        fields = (
            'id', 'service', 'service_name', 'service_label', 'message', 'service_address',
            'preferred_date', 'dismissed_at', 'organization_name', 'organization_slug',
            'customer_name', 'customer_email', 'customer_phone', 'created_at',
        )
        read_only_fields = fields


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

    class Meta:
        model = Service
        fields = (
            'id', 'organization', 'organization_slug', 'category', 'category_name',
            'name', 'description', 'image',
            'duration_minutes', 'pricing_type', 'base_price', 'price_max',
            'show_price', 'allow_request', 'is_active', 'sort_order',
            'rating_summary', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'organization_slug', 'category_name', 'rating_summary',
            'created_at', 'updated_at',
        )

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
    booking_id = serializers.IntegerField(source='booking.id', read_only=True, allow_null=True)
    booking_status = serializers.CharField(source='booking.status', read_only=True, allow_null=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    service_address = serializers.SerializerMethodField()

    class Meta:
        model = AvailabilitySlot
        fields = (
            'id', 'organization', 'organization_slug', 'service', 'service_name',
            'start_at', 'end_at', 'status', 'booking_id', 'booking_status',
            'customer_name', 'customer_phone', 'service_address',
            'created_by', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'organization_slug', 'service_name', 'status',
            'booking_id', 'booking_status', 'customer_name', 'customer_phone',
            'service_address', 'created_by', 'created_at', 'updated_at',
        )
        extra_kwargs = {
            'service': {'required': False, 'allow_null': True},
        }

    def get_service_name(self, obj):
        return obj.service.name if obj.service_id else 'Any service'

    def _booking(self, obj):
        return getattr(obj, 'booking', None)

    def get_customer_name(self, obj):
        b = self._booking(obj)
        return b.customer.full_name if b else None

    def get_customer_phone(self, obj):
        b = self._booking(obj)
        return (b.customer.phone or '') if b else None

    def get_service_address(self, obj):
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
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_slug = serializers.SlugField(source='organization.slug', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    slot_id = serializers.IntegerField(source='availability_slot_id', read_only=True, allow_null=True)

    class Meta:
        model = Booking
        fields = (
            'id', 'organization', 'organization_slug', 'organization_name',
            'service', 'service_name', 'service_duration_minutes', 'service_base_price',
            'customer', 'customer_name', 'customer_email', 'customer_phone',
            'slot_id', 'availability_slot', 'start_at', 'end_at', 'status', 'source',
            'customer_notes', 'service_address', 'status_events', 'created_at', 'updated_at',
        )
        read_only_fields = fields


class BookingSerializer(serializers.ModelSerializer):
    status_events = BookingStatusEventSerializer(many=True, read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_slug = serializers.SlugField(source='organization.slug', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    slot_id = serializers.PrimaryKeyRelatedField(
        queryset=AvailabilitySlot.objects.all(),
        source='availability_slot',
        write_only=True,
        required=False,
    )

    class Meta:
        model = Booking
        fields = (
            'id', 'organization', 'organization_slug', 'service', 'service_name',
            'organization_name', 'customer', 'customer_name', 'customer_email', 'customer_phone',
            'slot_id', 'availability_slot', 'start_at', 'end_at', 'status', 'source',
            'booked_by', 'customer_notes', 'service_address', 'status_events',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'customer_name', 'customer_email', 'customer_phone', 'service_name',
            'organization_name', 'organization_slug', 'availability_slot', 'source', 'booked_by',
            'status_events', 'created_at', 'updated_at',
        )
        extra_kwargs = {
            'organization': {'required': False},
            'service': {'required': False},
            'start_at': {'required': False},
            'end_at': {'required': False},
            'customer': {'required': False},
        }

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
    if not file_field or not getattr(file_field, 'url', None):
        return None
    if request:
        return request.build_absolute_uri(file_field.url)
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

    class Meta:
        model = Organization
        fields = (
            'id', 'name', 'slug', 'tagline', 'description', 'logo_url', 'banner_url',
            'booking_policy', 'gallery',
            'service_address', 'service_city', 'service_state', 'service_postal_code',
        )

    def get_logo_url(self, obj):
        return _absolute_media_url(self.context.get('request'), obj.logo)

    def get_banner_url(self, obj):
        return _absolute_media_url(self.context.get('request'), obj.banner)

    def get_gallery(self, obj):
        images = obj.gallery_images.all()[: OrganizationGalleryImage.MAX_PER_ORGANIZATION]
        return PublicGalleryImageSerializer(images, many=True, context=self.context).data


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
    class Meta:
        model = ServiceReview
        fields = ('communication', 'price', 'punctual', 'quality', 'comment')

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

    class Meta:
        model = Service
        fields = (
            'id', 'name', 'description', 'duration_minutes',
            'pricing_type', 'base_price', 'price_max', 'show_price', 'allow_request',
            'category_id', 'category_name', 'sort_order', 'image_url', 'rating_summary',
        )

    def get_image_url(self, obj):
        return _absolute_media_url(self.context.get('request'), obj.image)

    def get_rating_summary(self, obj):
        if hasattr(obj, '_rating_summary'):
            return obj._rating_summary
        return aggregate_service_ratings(obj.reviews.all())


class PublicServiceDetailSerializer(PublicServiceReadSerializer):
    gallery = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    my_review = serializers.SerializerMethodField()
    can_rate = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_slug = serializers.CharField(source='organization.slug', read_only=True)

    class Meta(PublicServiceReadSerializer.Meta):
        fields = PublicServiceReadSerializer.Meta.fields + (
            'gallery', 'reviews', 'my_review', 'can_rate',
            'organization_name', 'organization_slug',
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
