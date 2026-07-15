from rest_framework import serializers

from .models import BusinessType, Organization, OrganizationLocation, OrganizationMembership
from .postal import normalize_postal_code


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


class OrganizationLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationLocation
        fields = (
            'id', 'name', 'is_primary', 'address', 'city', 'state', 'postal_code',
            'latitude', 'longitude', 'radius_miles', 'is_active', 'sort_order',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_postal_code(self, value):
        raw = (value or '').strip()
        if not raw:
            return ''
        return normalize_postal_code(raw)

    def validate_radius_miles(self, value):
        from .location import parse_radius_miles
        return parse_radius_miles(value)

    def validate_latitude(self, value):
        from .location import quantize_coordinate
        if value is None:
            return None
        return quantize_coordinate(value)

    def validate_longitude(self, value):
        from .location import quantize_coordinate
        if value is None:
            return None
        return quantize_coordinate(value)

    def validate(self, attrs):
        lat = attrs.get('latitude', getattr(self.instance, 'latitude', None))
        lng = attrs.get('longitude', getattr(self.instance, 'longitude', None))
        postal = attrs.get('postal_code', getattr(self.instance, 'postal_code', '') if self.instance else '')
        city = attrs.get('city', getattr(self.instance, 'city', '') if self.instance else '')
        if lat is None and lng is None and not (postal or '').strip() and not (city or '').strip():
            raise serializers.ValidationError(
                'Set a map pin or at least a city / postal code for this location.'
            )
        if (lat is None) != (lng is None):
            raise serializers.ValidationError('Both latitude and longitude are required together.')
        return attrs


class PublicProviderCardSerializer(serializers.ModelSerializer):
    banner_url = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    locations_count = serializers.SerializerMethodField()
    rating_summary = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = (
            'public_ref', 'slug', 'name', 'tagline', 'booking_policy',
            'service_city', 'service_state', 'service_postal_code', 'service_address',
            'location', 'locations_count', 'banner_url', 'logo_url', 'rating_summary',
        )

    def get_location(self, obj):
        from .utils import organization_location_full

        return organization_location_full(obj) or None

    def get_locations_count(self, obj):
        if hasattr(obj, '_locations_count'):
            return obj._locations_count
        return obj.locations.filter(is_active=True).count()

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
