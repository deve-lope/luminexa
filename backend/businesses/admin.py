from django.contrib import admin

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


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'slug', 'subscription_status', 'subscription_source',
        'subscription_current_period_end', 'is_active', 'profile_public',
    )
    list_filter = ('subscription_status', 'subscription_source', 'is_active')
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name', 'slug')
    filter_horizontal = ('business_types',)
    inlines = [OrganizationLocationInline, OrganizationGalleryImageInline]


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
