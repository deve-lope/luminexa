from django.apps import AppConfig


class BusinessesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'businesses'

    def ready(self):
        from django.db.models.signals import post_save

        from .models import Organization
        from .public_refs import ensure_organization_public_ref

        def assign_org_ref(sender, instance, created, **kwargs):
            if not instance.public_ref:
                ensure_organization_public_ref(instance)

        post_save.connect(assign_org_ref, sender=Organization)
