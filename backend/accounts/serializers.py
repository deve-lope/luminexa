from django.contrib.auth import authenticate
from django.db import transaction
from rest_framework import serializers

from businesses.models import BusinessType, Organization, OrganizationMembership
from businesses.location import assign_org_coordinates
from businesses.postal import validate_postal_code
from businesses.utils import unique_organization_slug

from .models import User


class UserSerializer(serializers.ModelSerializer):
    has_booking_contact = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = (
            'id', 'public_ref', 'email', 'full_name', 'phone', 'default_service_address',
            'is_staff', 'has_booking_contact',
        )
        read_only_fields = ('id', 'public_ref', 'email', 'is_staff', 'has_booking_contact')


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)

    class Meta:
        model = User
        fields = ('email', 'full_name', 'password', 'phone')

    def create(self, validated_data):
        phone = validated_data.pop('phone', '') or ''
        return User.objects.create_user(phone=phone, **validated_data)


class RegisterBusinessSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=200)
    password = serializers.CharField(write_only=True, min_length=8)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
    business_name = serializers.CharField(max_length=200)
    booking_policy = serializers.ChoiceField(
        choices=Organization.BookingPolicy.choices,
        default=Organization.BookingPolicy.APPROVAL,
        required=False,
    )
    service_city = serializers.CharField(max_length=120)
    service_postal_code = serializers.CharField(max_length=12)
    service_state = serializers.CharField(max_length=80, required=False, allow_blank=True, default='')
    service_address = serializers.CharField(max_length=300, required=False, allow_blank=True, default='')
    business_type_slugs = serializers.ListField(
        child=serializers.SlugField(),
        allow_empty=False,
        min_length=1,
    )

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value.lower()

    def validate_service_city(self, value):
        city = (value or '').strip()
        if len(city) < 2:
            raise serializers.ValidationError('Enter the city where you provide services.')
        return city

    def validate_service_postal_code(self, value):
        return validate_postal_code(value)

    def validate_business_type_slugs(self, slugs):
        unique_slugs = list(dict.fromkeys(slugs))
        found = BusinessType.objects.filter(slug__in=unique_slugs, is_active=True)
        found_slugs = set(found.values_list('slug', flat=True))
        missing = [s for s in unique_slugs if s not in found_slugs]
        if missing:
            raise serializers.ValidationError(
                f'Unknown or inactive business type(s): {", ".join(missing)}'
            )
        return unique_slugs

    @transaction.atomic
    def create(self, validated_data):
        type_slugs = validated_data.pop('business_type_slugs')
        business_name = validated_data.pop('business_name')
        booking_policy = validated_data.pop('booking_policy', Organization.BookingPolicy.APPROVAL)
        service_city = validated_data.pop('service_city')
        service_postal_code = validated_data.pop('service_postal_code')
        service_state = (validated_data.pop('service_state', '') or '').strip()
        service_address = (validated_data.pop('service_address', '') or '').strip()
        phone = validated_data.pop('phone', '') or ''
        password = validated_data.pop('password')

        user = User.objects.create_user(
            email=validated_data['email'],
            full_name=validated_data['full_name'],
            phone=phone,
            password=password,
        )
        org = Organization.objects.create(
            name=business_name,
            slug=unique_organization_slug(business_name),
            profile_public=True,
            is_active=True,
            booking_policy=booking_policy,
            service_city=service_city,
            service_postal_code=service_postal_code,
            service_state=service_state,
            service_address=service_address,
        )
        types = BusinessType.objects.filter(slug__in=type_slugs, is_active=True)
        org.business_types.set(types)
        assign_org_coordinates(org)
        OrganizationMembership.objects.create(
            organization=org,
            user=user,
            role=OrganizationMembership.Role.OWNER,
        )
        return user, org


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get('request'),
            email=attrs['email'],
            password=attrs['password'],
        )
        if not user:
            raise serializers.ValidationError('Invalid email or password.')
        if not user.is_active:
            raise serializers.ValidationError('This account is disabled.')
        attrs['user'] = user
        return attrs
