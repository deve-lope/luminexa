from django.db.models.signals import pre_save
from django.dispatch import receiver

from .models import User
from .public_refs import next_user_public_ref


@receiver(pre_save, sender=User)
def assign_user_public_ref(sender, instance, **kwargs):
    if not instance.public_ref:
        instance.public_ref = next_user_public_ref()
