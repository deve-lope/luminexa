from datetime import timedelta

from django.contrib import admin, messages
from django.contrib.admin.helpers import ACTION_CHECKBOX_NAME
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone

from .models import (
    BusinessType,
    Organization,
    OrganizationGalleryImage,
    OrganizationLocation,
    OrganizationMembership,
    PostalGeocode,
    PromoCode,
    PromoRedemption,
    StaffInvitation,
)


@admin.register(BusinessType)
class BusinessTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'location_kind', 'sort_order', 'is_active')
    list_filter = ('location_kind', 'is_active')
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name', 'slug')


class OrganizationGalleryImageInline(admin.TabularInline):
    model = OrganizationGalleryImage
    extra = 0
    max_num = OrganizationGalleryImage.MAX_PER_ORGANIZATION


class OrganizationLocationInline(admin.TabularInline):
    model = OrganizationLocation
    extra = 0
    max_num = OrganizationLocation.MAX_PER_ORGANIZATION
    fields = (
        'name', 'is_primary', 'is_active', 'address', 'city', 'state',
        'postal_code', 'latitude', 'longitude', 'radius_miles', 'sort_order',
    )


class SubscriptionEndingSoonFilter(admin.SimpleListFilter):
    title = 'subscription ending'
    parameter_name = 'sub_ending'

    def lookups(self, request, model_admin):
        return (
            ('7', 'Within 7 days'),
            ('14', 'Within 14 days'),
            ('30', 'Within 30 days'),
            ('expired', 'Already ended (period end in past)'),
        )

    def queryset(self, request, queryset):
        value = self.value()
        if not value:
            return queryset
        now = timezone.now()
        qs = queryset.exclude(subscription_current_period_end__isnull=True)
        if value == 'expired':
            return qs.filter(subscription_current_period_end__lt=now)
        try:
            days = int(value)
        except (TypeError, ValueError):
            return queryset
        return qs.filter(
            subscription_current_period_end__gte=now,
            subscription_current_period_end__lte=now + timedelta(days=days),
        )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'slug', 'subscription_status', 'subscription_source',
        'subscription_current_period_end', 'is_active', 'profile_public',
    )
    list_filter = (
        SubscriptionEndingSoonFilter,
        'subscription_status',
        'subscription_source',
        'is_active',
    )
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name', 'slug')
    filter_horizontal = ('business_types',)
    inlines = [OrganizationLocationInline, OrganizationGalleryImageInline]
    actions = ['send_promo_offer_notification']

    @admin.action(description='Send promo offer notification…')
    def send_promo_offer_notification(self, request, queryset):
        from jobs.promo_services import send_promo_offer_notifications

        if 'apply' in request.POST:
            promo_id = request.POST.get('promo_code_id')
            custom_message = request.POST.get('custom_message', '')
            promo = PromoCode.objects.filter(pk=promo_id, is_active=True).first()
            if not promo:
                self.message_user(
                    request,
                    'Select an active promo code (create one under Promo codes first).',
                    level=messages.ERROR,
                )
                return redirect(reverse('admin:businesses_organization_changelist'))

            created = send_promo_offer_notifications(
                organizations=queryset,
                promo=promo,
                custom_message=custom_message,
            )
            skipped = queryset.count() - created
            self.message_user(
                request,
                f'Sent {created} promo notification(s) with code {promo.code}'
                + (f' ({skipped} skipped — already redeemed).' if skipped else '.'),
                level=messages.SUCCESS if created else messages.WARNING,
            )
            return redirect(reverse('admin:businesses_organization_changelist'))

        promo_codes = PromoCode.objects.filter(is_active=True).order_by('-created_at')
        if not promo_codes.exists():
            self.message_user(
                request,
                'No active promo codes. Create one under Businesses → Promo codes first.',
                level=messages.ERROR,
            )
            return redirect(reverse('admin:businesses_organization_changelist'))

        context = {
            **self.admin_site.each_context(request),
            'title': 'Send promo offer notification',
            'organizations': queryset.order_by('name'),
            'promo_codes': promo_codes,
            'action_checkbox_name': ACTION_CHECKBOX_NAME,
            'cancel_url': reverse('admin:businesses_organization_changelist'),
            'opts': self.model._meta,
        }
        return render(
            request,
            'admin/businesses/organization/send_promo_offer.html',
            context,
        )


@admin.register(OrganizationLocation)
class OrganizationLocationAdmin(admin.ModelAdmin):
    list_display = (
        'organization', 'name', 'city', 'postal_code', 'is_primary',
        'is_active', 'radius_miles', 'latitude', 'longitude',
    )
    list_filter = ('is_primary', 'is_active')
    search_fields = ('organization__slug', 'name', 'city', 'postal_code')


@admin.register(PostalGeocode)
class PostalGeocodeAdmin(admin.ModelAdmin):
    list_display = ('postal_code', 'city', 'state', 'country', 'latitude', 'longitude', 'source')
    search_fields = ('postal_code', 'lookup_key')


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'organization', 'role', 'created_at')
    list_filter = ('role',)


@admin.register(StaffInvitation)
class StaffInvitationAdmin(admin.ModelAdmin):
    list_display = ('email', 'organization', 'accepted_at', 'created_at')
    search_fields = ('email', 'organization__slug')


class PromoRedemptionInline(admin.TabularInline):
    model = PromoRedemption
    extra = 0
    can_delete = False
    readonly_fields = ('organization', 'redeemed_by', 'granted_until', 'created_at')
    fields = readonly_fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PromoCode)
class PromoCodeAdmin(admin.ModelAdmin):
    list_display = (
        'code', 'grant_weeks', 'valid_from', 'valid_until',
        'redemption_count_display', 'max_redemptions', 'is_active', 'created_at',
    )
    list_filter = ('is_active',)
    search_fields = ('code', 'note')
    readonly_fields = ('created_at',)
    inlines = [PromoRedemptionInline]

    def redemption_count_display(self, obj):
        return obj.redemption_count

    redemption_count_display.short_description = 'Redemptions'

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by_id:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(PromoRedemption)
class PromoRedemptionAdmin(admin.ModelAdmin):
    list_display = ('promo_code', 'organization', 'redeemed_by', 'granted_until', 'created_at')
    search_fields = ('promo_code__code', 'organization__slug', 'redeemed_by__email')
    readonly_fields = ('promo_code', 'organization', 'redeemed_by', 'granted_until', 'created_at')
