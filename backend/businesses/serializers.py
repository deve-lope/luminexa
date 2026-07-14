from rest_framework import serializers

from .models import BusinessType, Organization, OrganizationMembership


class OrganizationMembershipReadSerializer(serializers.ModelSerializer):
    organization_slug = serializers.CharField(source='organization.slug', read_only=True)
    organization_public_ref = serializers.CharField(source='organization.public_ref', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = (
            'id',
            'organization',
            'organization_slug',
            'organization_public_ref',
            'organization_name',
            'role',
            'customer_status',
            'created_at',
        )
        read_only_fields = fields


class BusinessTypeSerializer(serializers.ModelSerializer):
    provider_count = serializers.IntegerField(read_only=True, required=False)
    requires_business_address = serializers.SerializerMethodField()

    class Meta:
        model = BusinessType
        fields = (
            'slug',
            'name',
            'description',
            'icon',
            'location_kind',
            'requires_business_address',
            'sort_order',
            'provider_count',
        )

    def get_requires_business_address(self, obj):
        return obj.location_kind == BusinessType.LocationKind.OFFICE


class BusinessTypeCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    icon = serializers.CharField(max_length=16, required=False, allow_blank=True, default='')
    description = serializers.CharField(max_length=400, required=False, allow_blank=True, default='')
    location_kind = serializers.ChoiceField(
        choices=BusinessType.LocationKind.choices,
        default=BusinessType.LocationKind.MOBILE,
        required=False,
    )

    def validate_name(self, value):
        name = (value or '').strip()
        if len(name) < 2:
            raise serializers.ValidationError('Name must be at least 2 characters.')
        return name


class PublicProviderCardSerializer(serializers.ModelSerializer):
    banner_url = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    rating_summary = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = (
            'public_ref', 'slug', 'name', 'tagline', 'booking_policy',
            'service_city', 'service_state', 'service_postal_code', 'service_address',
            'location', 'banner_url', 'logo_url', 'rating_summary',
        )

    def get_location(self, obj):
        from .utils import organization_location_full

        return organization_location_full(obj) or None

    def get_banner_url(self, obj):
        if obj.banner and getattr(obj.banner, 'url', None):
            return obj.banner.url
        return None

    def get_logo_url(self, obj):
        if obj.logo and getattr(obj.logo, 'url', None):
            return obj.logo.url
        return None

    def get_rating_summary(self, obj):
        from jobs.ratings import aggregate_organization_ratings

        return aggregate_organization_ratings(obj)
