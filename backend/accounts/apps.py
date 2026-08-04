from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        from . import signals  # noqa: F401

        # Require Google Authenticator–compatible TOTP for every Django admin session.
        from django.contrib import admin
        from two_factor.admin import AdminSiteOTPRequired

        admin.site.__class__ = AdminSiteOTPRequired
