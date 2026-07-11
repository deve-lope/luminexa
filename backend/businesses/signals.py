from django.db.models.signals import pre_save
from django.dispatch import receiver

from .models import Organization
from .public_refs import next_organization_public_ref


@receiver(pre_save, sender=Organization)
def assign_organization_public_ref(sender, instance, **kwargs):
    if not instance.public_ref:
        instance.public_ref = next_organization_public_ref()
