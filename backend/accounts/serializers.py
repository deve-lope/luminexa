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
    needs_onboarding = serializers.SerializerMethodField()
    can_access_django_admin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'public_ref', 'email', 'full_name', 'phone', 'default_service_address',
            'address_country', 'email_verified', 'can_access_django_admin',
            'has_booking_contact', 'onboarding_completed_at', 'needs_onboarding',
        )
        read_only_fields = (
            'id', 'public_ref', 'email', 'email_verified', 'can_access_django_admin',
            'has_booking_contact', 'onboarding_completed_at', 'needs_onboarding',
        )

    def get_needs_onboarding(self, obj):
        return obj.onboarding_completed_at is None

    def get_can_access_django_admin(self, obj):
        return bool(obj.is_staff or obj.is_superuser)


class RegisterSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
    address_country = serializers.CharField(required=False, allow_blank=True, max_length=80)

    class Meta:
        model = User
        fields = ('email', 'full_name', 'phone', 'address_country')

    def validate_email(self, value):
        email = (value or '').strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return email

    def create(self, validated_data):
        phone = validated_data.pop('phone', '') or ''
        address_country = (validated_data.pop('address_country', '') or '').strip()
        user = User.objects.create_user(
            phone=phone,
            password=None,
            email_verified=False,
            **validated_data,
        )
        if address_country:
            user.address_country = address_country
            user.save(update_fields=['address_country'])
        return user


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
    concurrent_capacity = serializers.IntegerField(
        required=False,
        default=1,
        min_value=1,
        max_value=50,
        help_text='How many people can work / take bookings at the same time.',
    )
    service_city = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default='',
    )
    service_postal_code = serializers.CharField(
        max_length=12, required=False, allow_blank=True, default='',
    )
    service_state = serializers.CharField(max_length=80, required=False, allow_blank=True, default='')
    service_address = serializers.CharField(max_length=300, required=False, allow_blank=True, default='')
    address_country = serializers.CharField(required=False, allow_blank=True, max_length=80)
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
        return (value or '').strip()

    def validate_service_postal_code(self, value):
        raw = (value or '').strip()
        if not raw:
            return ''
        return validate_postal_code(raw)

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

    def validate(self, attrs):
        type_slugs = attrs.get('business_type_slugs') or []
        needs_address = BusinessType.objects.filter(
            slug__in=type_slugs,
            is_active=True,
            location_kind=BusinessType.LocationKind.OFFICE,
        ).exists()
        attrs['_needs_business_address'] = needs_address
        if needs_address:
            city = (attrs.get('service_city') or '').strip()
            postal = (attrs.get('service_postal_code') or '').strip()
            if len(city) < 2:
                raise serializers.ValidationError(
                    {
                        'service_city': (
                            'Enter your business office / home address city for billing.'
                        ),
                    }
                )
            if not postal:
                raise serializers.ValidationError(
                    {
                        'service_postal_code': (
                            'Enter your business office / home postal code for billing.'
                        ),
                    }
                )
        else:
            # Mobile-only businesses have no fixed billing address at signup.
            attrs['service_city'] = ''
            attrs['service_postal_code'] = ''
            attrs['service_state'] = ''
            attrs['service_address'] = ''
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop('_needs_business_address', None)
        type_slugs = validated_data.pop('business_type_slugs')
        business_name = validated_data.pop('business_name')
        booking_policy = validated_data.pop('booking_policy', Organization.BookingPolicy.APPROVAL)
        concurrent_capacity = int(validated_data.pop('concurrent_capacity', 1) or 1)
        concurrent_capacity = max(1, min(50, concurrent_capacity))
        service_city = (validated_data.pop('service_city', '') or '').strip()
        service_postal_code = (validated_data.pop('service_postal_code', '') or '').strip()
        service_state = (validated_data.pop('service_state', '') or '').strip()
        service_address = (validated_data.pop('service_address', '') or '').strip()
        address_country = (validated_data.pop('address_country', '') or '').strip()
        phone = validated_data.pop('phone', '') or ''
        password = validated_data.pop('password')

        user = User.objects.create_user(
            email=validated_data['email'],
            full_name=validated_data['full_name'],
            phone=phone,
            password=password,
            email_verified=False,
        )
        if address_country:
            user.address_country = address_country
            user.save(update_fields=['address_country'])
        org = Organization.objects.create(
            name=business_name,
            slug=unique_organization_slug(business_name),
            profile_public=True,
            is_active=True,
            booking_policy=booking_policy,
            concurrent_capacity=concurrent_capacity,
            service_city=service_city,
            service_postal_code=service_postal_code,
            service_state=service_state,
            service_address=service_address,
        )
        types = BusinessType.objects.filter(slug__in=type_slugs, is_active=True)
        org.business_types.set(types)
        if service_city or service_postal_code:
            assign_org_coordinates(org)
        from businesses.location import ensure_primary_location
        ensure_primary_location(org)
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


class EmailVerifySerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


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
        from .otp import user_uses_password_login

        if not user_uses_password_login(user):
            raise serializers.ValidationError(
                'Customers sign in with an email code, not a password.'
            )
        attrs['user'] = user
        return attrs


class LoginStartSerializer(serializers.Serializer):
    email = serializers.EmailField()


class LoginOtpRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class LoginOtpVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=4, max_length=8)
