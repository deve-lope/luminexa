from django.conf import settings
from rest_framework.exceptions import PermissionDenied

from businesses.models import Organization, OrganizationMembership


def membership_for(user, organization: Organization):
    if not user or not user.is_authenticated:
        return None
    return OrganizationMembership.objects.filter(user=user, organization=organization).first()


def is_org_member(user, organization: Organization) -> bool:
    return membership_for(user, organization) is not None


def is_org_staff(user, organization: Organization) -> bool:
    m = membership_for(user, organization)
    return bool(m and m.can_manage_schedule)


def org_has_active_subscription(organization: Organization) -> bool:
    """True when provider ops are allowed (Stripe off, or active/trialing)."""
    if not getattr(settings, 'STRIPE_ENABLED', False):
        return True
    status = (getattr(organization, 'subscription_status', None) or 'none').lower()
    return status in ('active', 'trialing')


def require_provider_subscription(organization: Organization) -> None:
    """
    Block provider operational APIs when Stripe billing is enabled and the org
    has no active/trialing subscription. Billing/settings/setup stay exempt by
    simply not calling this helper.
    """
    if org_has_active_subscription(organization):
        return
    raise PermissionDenied({
        'detail': 'An active Luminexa Pro subscription is required to manage this business.',
        'code': 'subscription_required',
    })


def require_staff_ops(user, organization: Organization) -> None:
    """Staff check + subscription gate for provider operational mutations."""
    if not is_org_staff(user, organization):
        raise PermissionDenied('You must be staff of this organization.')
    require_provider_subscription(organization)
