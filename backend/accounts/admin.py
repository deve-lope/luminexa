from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Only superusers may grant or revoke staff / superuser (admin) access."""

    ordering = ('email',)
    list_display = ('email', 'full_name', 'is_staff', 'is_superuser', 'is_active', 'last_login')
    list_filter = ('is_staff', 'is_superuser', 'is_active')
    search_fields = ('email', 'full_name')
    readonly_fields = ('last_login', 'date_joined')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal', {'fields': ('full_name', 'phone', 'default_service_address')}),
        (
            'Permissions',
            {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')},
        ),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('email', 'full_name', 'password1', 'password2'),
            },
        ),
    )

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)
        if request.user.is_superuser:
            return fieldsets
        # Non-superuser staff cannot see elevation controls.
        scrubbed = []
        for name, opts in fieldsets:
            fields = opts.get('fields', ())
            if name == 'Permissions':
                fields = tuple(
                    f for f in fields if f not in ('is_staff', 'is_superuser', 'groups', 'user_permissions')
                )
                scrubbed.append((name, {**opts, 'fields': fields or ('is_active',)}))
            else:
                scrubbed.append((name, opts))
        return scrubbed

    def get_readonly_fields(self, request, obj=None):
        readonly = list(super().get_readonly_fields(request, obj))
        if not request.user.is_superuser:
            readonly.extend(['is_staff', 'is_superuser', 'groups', 'user_permissions'])
        elif obj and obj.pk == request.user.pk:
            # Do not let an admin accidentally demote themselves.
            readonly.extend(['is_staff', 'is_superuser'])
        return list(dict.fromkeys(readonly))

    def get_add_fieldsets(self, request):
        fieldsets = list(super().get_add_fieldsets(request))
        if request.user.is_superuser:
            # Superuser may create another admin in one step.
            return (
                (
                    None,
                    {
                        'classes': ('wide',),
                        'fields': (
                            'email',
                            'full_name',
                            'password1',
                            'password2',
                            'is_staff',
                            'is_superuser',
                        ),
                    },
                ),
            )
        return fieldsets

    def save_model(self, request, obj, form, change):
        if not request.user.is_superuser:
            if not change:
                obj.is_staff = False
                obj.is_superuser = False
            else:
                try:
                    previous = User.objects.get(pk=obj.pk)
                except User.DoesNotExist:
                    previous = None
                if previous is not None:
                    obj.is_staff = previous.is_staff
                    obj.is_superuser = previous.is_superuser
        super().save_model(request, obj, form, change)

    def has_module_permission(self, request):
        return bool(request.user.is_staff)

    def has_view_permission(self, request, obj=None):
        return bool(request.user.is_staff)

    def has_change_permission(self, request, obj=None):
        return bool(request.user.is_staff)

    def has_add_permission(self, request):
        # Only superusers create users from admin (customers use public signup).
        return bool(request.user.is_superuser)

    def has_delete_permission(self, request, obj=None):
        if not request.user.is_superuser:
            return False
        if obj and obj.is_superuser and obj.pk == request.user.pk:
            return False
        return True
