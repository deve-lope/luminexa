from django.contrib import admin

from .models import (
    CustomerServiceInquiry,
    AvailabilitySlot,
    Booking,
    Service,
    ServiceCategory,
    ServiceRequestMessage,
    Task,
    UnavailableBlock,
)


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'sort_order', 'is_active')
    list_filter = ('organization',)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'organization', 'category', 'pricing_type', 'base_price', 'show_price', 'is_active',
    )
    list_filter = ('organization', 'pricing_type')


@admin.register(UnavailableBlock)
class UnavailableBlockAdmin(admin.ModelAdmin):
    list_display = ('organization', 'start_at', 'end_at', 'note')
    list_filter = ('organization',)


@admin.register(AvailabilitySlot)
class AvailabilitySlotAdmin(admin.ModelAdmin):
    list_display = ('organization', 'service', 'start_at', 'status')
    list_filter = ('status', 'organization')


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('service', 'customer', 'start_at', 'status', 'source', 'organization')
    list_filter = ('status', 'source', 'organization')


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'organization', 'due_at', 'recurrence', 'is_done', 'priority')
    list_filter = ('is_done', 'recurrence', 'organization')


@admin.register(ServiceRequestMessage)
class ServiceRequestMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'booking', 'inquiry', 'sender', 'created_at')
    list_filter = ('created_at',)


@admin.register(CustomerServiceInquiry)
class CustomerServiceInquiryAdmin(admin.ModelAdmin):
    list_display = ('organization', 'customer', 'service_label', 'status', 'created_at', 'dismissed_at')
    list_filter = ('organization', 'status', 'dismissed_at')
