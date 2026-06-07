from django.contrib import admin

from .models import (
    BusinessType,
    Organization,
    OrganizationGalleryImage,
    OrganizationMembership,
    PostalGeocode,
    StaffInvitation,
)


@admin.register(BusinessType)
class BusinessTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'sort_order', 'is_active')
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name', 'slug')


class OrganizationGalleryImageInline(admin.TabularInline):
    model = OrganizationGalleryImage
    extra = 0
    max_num = OrganizationGalleryImage.MAX_PER_ORGANIZATION


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'slug', 'service_postal_code', 'service_city', 'service_state',
        'service_latitude', 'service_longitude', 'is_active', 'profile_public',
    )
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name', 'slug')
    filter_horizontal = ('business_types',)
    inlines = [OrganizationGalleryImageInline]


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
