"""Serializers for the Gig Wall feature."""

from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.db.models import Avg, F
from django.utils import timezone
from rest_framework import serializers

from businesses.location import haversine_miles
from businesses.models import BusinessType
from luminexa.uploads import validate_uploaded_image_django

from .gig_geocode import assign_gig_coordinates
from .models import GigComment, GigPost, GigPostImage, GigQuote, ServiceReview


class BusinessTypeIdentifierField(serializers.Field):
    """Accept a BusinessType slug (public API id) or numeric PK.

    The business-types list endpoint does not expose integer ids, so the
    customer create form sends ``slug``. HTML <select> values are also always
    strings, which DRF's default PK field rejects as "Expected pk value, received str."
    """

    default_error_messages = {
        'invalid': 'Choose a valid category.',
        'inactive': 'Choose an active category.',
    }

    def to_internal_value(self, data):
        if data in (None, ''):
            return None
        qs = BusinessType.objects.all()
        obj = None
        if isinstance(data, bool):
            self.fail('invalid')
        if isinstance(data, int) or (isinstance(data, str) and data.strip().isdigit()):
            obj = qs.filter(pk=int(data)).first()
        if obj is None:
            obj = qs.filter(slug=str(data).strip()).first()
        if obj is None:
            self.fail('invalid')
        if not obj.is_active:
            self.fail('inactive')
        return obj

    def to_representation(self, value):
        if value is None:
            return None
        return value.slug


class GigPostImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GigPostImage
        fields = ['id', 'image', 'sort_order', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_image(self, value):
        validate_uploaded_image_django(value, max_bytes=GigPostImage.MAX_BYTES)
        name = getattr(value, 'name', '') or ''
        ext = Path(name).suffix.lower()
        if ext and ext not in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}:
            raise serializers.ValidationError('Use a JPEG, PNG, WebP, or GIF image.')
        return value


class GigPostSerializer(serializers.ModelSerializer):
    images = GigPostImageSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    category_name = serializers.SerializerMethodField()
    category_slug = serializers.SerializerMethodField()
    quote_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = GigPost
        fields = [
            'id',
            'customer',
            'customer_name',
            'title',
            'description',
            'category',
            'category_name',
            'category_slug',
            'location_address',
            'location_city',
            'location_state',
            'location_postal_code',
            'location_latitude',
            'location_longitude',
            'search_radius_miles',
            'status',
            'expires_at',
            'created_at',
            'updated_at',
            'images',
            'quote_count',
            'comment_count',
            'is_mine',
        ]
        read_only_fields = [
            'id', 'customer', 'created_at', 'updated_at', 'status', 'expires_at',
            'location_latitude', 'location_longitude',
        ]

    def get_category_name(self, obj):
        return obj.category.name if obj.category_id else ''

    def get_category_slug(self, obj):
        return obj.category.slug if obj.category_id else ''

    def get_quote_count(self, obj):
        if hasattr(obj, '_quote_count'):
            return obj._quote_count
        return obj.quotes.exclude(status=GigQuote.Status.WITHDRAWN).count()

    def get_comment_count(self, obj):
        if hasattr(obj, '_comment_count'):
            return obj._comment_count
        return obj.comments.count()

    def get_is_mine(self, obj):
        request = self.context.get('request')
        return bool(request and request.user and obj.customer_id == request.user.id)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Hide precise address from other customers on the public wall
        if not data.get('is_mine'):
            data['location_address'] = ''
            data['location_postal_code'] = ''
            data['location_latitude'] = None
            data['location_longitude'] = None
        return data


class GigPostWriteSerializer(serializers.ModelSerializer):
    category = BusinessTypeIdentifierField(required=False, allow_null=True)

    class Meta:
        model = GigPost
        fields = [
            'id',
            'title',
            'description',
            'category',
            'location_address',
            'location_city',
            'location_state',
            'location_postal_code',
            'search_radius_miles',
        ]
        read_only_fields = ['id']

    def validate_title(self, value):
        title = (value or '').strip()
        if not title:
            raise serializers.ValidationError('Title is required.')
        if len(title) > 200:
            raise serializers.ValidationError('Title must be 200 characters or fewer.')
        return title

    def validate_description(self, value):
        desc = (value or '').strip()
        if not desc:
            raise serializers.ValidationError('Description is required.')
        if len(desc) > 2000:
            raise serializers.ValidationError('Description must be 2000 characters or fewer.')
        return desc

    def validate_search_radius_miles(self, value):
        miles = float(value)
        if miles < 1 or miles > 100:
            raise serializers.ValidationError('Radius must be between 1 and 100 miles.')
        return Decimal(str(round(miles, 1)))

    def create(self, validated_data):
        request = self.context['request']
        validated_data['customer'] = request.user
        validated_data['expires_at'] = timezone.now() + timedelta(days=30)
        post = GigPost.objects.create(**validated_data)
        assign_gig_coordinates(post, save=True)
        return post

    def update(self, instance, validated_data):
        # Location changes: re-geocode when postal/city/state change
        location_changed = any(
            field in validated_data
            for field in (
                'location_postal_code', 'location_city', 'location_state', 'location_address',
            )
        )
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if location_changed:
            assign_gig_coordinates(instance, save=True)
        return instance


class GigCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.full_name', read_only=True)
    organization_name = serializers.SerializerMethodField()
    is_customer_comment = serializers.SerializerMethodField()

    class Meta:
        model = GigComment
        fields = [
            'id',
            'author_name',
            'organization_name',
            'body',
            'created_at',
            'is_customer_comment',
        ]
        read_only_fields = fields

    def get_organization_name(self, obj):
        return obj.organization.name if obj.organization_id else ''

    def get_is_customer_comment(self, obj):
        return obj.gig_post.customer_id == obj.author_id


class GigCommentWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = GigComment
        fields = ['body']

    def validate_body(self, value):
        body = (value or '').strip()
        if not body:
            raise serializers.ValidationError('Comment cannot be empty.')
        if len(body) > 1000:
            raise serializers.ValidationError('Comment must be 1000 characters or fewer.')
        return body


class GigQuoteOrganizationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField()
    logo = serializers.SerializerMethodField()
    public_ref = serializers.CharField()

    def get_logo(self, obj):
        if obj.logo:
            request = self.context.get('request')
            url = obj.logo.url
            if request:
                return request.build_absolute_uri(url)
            return url
        return None


class GigQuoteSerializer(serializers.ModelSerializer):
    organization = serializers.SerializerMethodField()
    organization_distance = serializers.SerializerMethodField()
    organization_rating = serializers.SerializerMethodField()

    class Meta:
        model = GigQuote
        fields = [
            'id',
            'organization',
            'organization_distance',
            'organization_rating',
            'price',
            'description',
            'estimated_duration_days',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_organization(self, obj):
        return GigQuoteOrganizationSerializer(obj.organization, context=self.context).data

    def get_organization_distance(self, obj):
        gig_post = obj.gig_post
        if gig_post.location_latitude is None or gig_post.location_longitude is None:
            return None
        org_loc = obj.organization.primary_location()
        if not org_loc or org_loc.latitude is None or org_loc.longitude is None:
            if (
                obj.organization.service_latitude is not None
                and obj.organization.service_longitude is not None
            ):
                dist = haversine_miles(
                    float(obj.organization.service_latitude),
                    float(obj.organization.service_longitude),
                    float(gig_post.location_latitude),
                    float(gig_post.location_longitude),
                )
                return round(dist, 1)
            return None
        dist = haversine_miles(
            float(org_loc.latitude),
            float(org_loc.longitude),
            float(gig_post.location_latitude),
            float(gig_post.location_longitude),
        )
        return round(dist, 1)

    def get_organization_rating(self, obj):
        avg = ServiceReview.objects.filter(
            service__organization_id=obj.organization_id,
        ).aggregate(
            avg_rating=Avg(
                (F('communication') + F('price') + F('punctual') + F('quality')) / 4.0
            )
        )['avg_rating']
        return round(float(avg), 1) if avg is not None else None


class GigQuoteWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = GigQuote
        fields = ['price', 'description', 'estimated_duration_days']

    def validate_price(self, value):
        if value is None or value < Decimal('0.01'):
            raise serializers.ValidationError('Price must be at least 0.01.')
        return value

    def validate_description(self, value):
        desc = (value or '').strip()
        if not desc:
            raise serializers.ValidationError('Describe what this quote covers.')
        if len(desc) > 1500:
            raise serializers.ValidationError('Description must be 1500 characters or fewer.')
        return desc


class GigQuoteListItemSerializer(GigQuoteSerializer):
    """Provider my-quotes list includes the gig post summary."""

    gig_post = serializers.SerializerMethodField()

    class Meta(GigQuoteSerializer.Meta):
        fields = GigQuoteSerializer.Meta.fields + ['gig_post']

    def get_gig_post(self, obj):
        post = obj.gig_post
        return {
            'id': post.id,
            'title': post.title,
            'customer_name': post.customer.full_name if post.customer_id else '',
            'status': post.status,
            'location_city': post.location_city,
            'location_state': post.location_state,
        }
