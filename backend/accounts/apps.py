from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        from django.db.models.signals import post_save

        from .models import User
        from .public_refs import ensure_user_public_ref

        def assign_user_ref(sender, instance, created, **kwargs):
            if not instance.public_ref:
                ensure_user_public_ref(instance)

        post_save.connect(assign_user_ref, sender=User)
