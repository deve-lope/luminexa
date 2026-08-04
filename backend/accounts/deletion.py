"""Account deletion (soft delete / anonymize).

Google Play's User Data policy requires that accounts created in the app can be
deleted on request, both in-app and via a public web URL. We soft-delete: the
account is deactivated and all personal data is scrubbed, while booking/invoice
rows are anonymized in place and retained for legal / tax / dispute purposes.
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ValidationError

from .models import LoginCode, ProviderDeletionFeedback, User

logger = logging.getLogger(__name__)

PROVIDER_DELETION_REASONS = {c.value for c in ProviderDeletionFeedback.Reason}


def _deactivate_owned_organizations(user: User) -> None:
    """Take any organization this user owns off public search / browse."""
    try:
        from businesses.models import Organization, OrganizationMembership
    except Exception:  # pragma: no cover - businesses app should always load
        logger.exception('Could not import businesses models during account deletion')
        return

    owned_org_ids = (
        OrganizationMembership.objects.filter(
            user=user, role=OrganizationMembership.Role.OWNER
        )
        .values_list('organization_id', flat=True)
        .distinct()
    )
    if owned_org_ids:
        Organization.objects.filter(id__in=list(owned_org_ids)).update(
            is_active=False, profile_public=False
        )


def user_is_provider(user: User) -> bool:
    try:
        from businesses.models import OrganizationMembership
    except Exception:
        return False
    return OrganizationMembership.objects.filter(
        user=user,
        role__in=(
            OrganizationMembership.Role.OWNER,
            OrganizationMembership.Role.STAFF,
        ),
    ).exists()


def _provider_subscription_snapshot(user: User) -> dict:
    """Pick the most relevant owned org for churn context."""
    try:
        from businesses.models import OrganizationMembership
        from jobs.permissions import org_has_active_subscription
    except Exception:
        return {
            'was_owner': False,
            'had_active_subscription': False,
            'subscription_status': '',
            'subscription_plan': '',
            'subscription_source': '',
            'organization_slug': '',
            'organization_name': '',
        }

    memberships = list(
        OrganizationMembership.objects.filter(user=user)
        .select_related('organization')
        .order_by('-role', 'id')
    )
    owner = next(
        (m for m in memberships if m.role == OrganizationMembership.Role.OWNER),
        None,
    )
    staff = next(
        (m for m in memberships if m.role == OrganizationMembership.Role.STAFF),
        None,
    )
    m = owner or staff
    if not m:
        return {
            'was_owner': False,
            'had_active_subscription': False,
            'subscription_status': '',
            'subscription_plan': '',
            'subscription_source': '',
            'organization_slug': '',
            'organization_name': '',
        }
    org = m.organization
    return {
        'was_owner': m.role == OrganizationMembership.Role.OWNER,
        'had_active_subscription': org_has_active_subscription(org),
        'subscription_status': (org.subscription_status or '')[:32],
        'subscription_plan': (org.subscription_plan or '')[:32],
        'subscription_source': (getattr(org, 'subscription_source', None) or '')[:32],
        'organization_slug': (org.slug or '')[:120],
        'organization_name': (org.name or '')[:255],
    }


def record_provider_deletion_feedback(
    *,
    user: User,
    reason: str,
    detail: str = '',
    channel: str = ProviderDeletionFeedback.Channel.IN_APP,
) -> ProviderDeletionFeedback | None:
    """Persist churn reason for providers. No-op for customers. Raises if provider omits reason."""
    if not user_is_provider(user):
        return None

    reason = (reason or '').strip()
    if reason not in PROVIDER_DELETION_REASONS:
        raise ValidationError(
            {
                'deletion_reason': (
                    'Please tell us why you’re leaving / not renewing so we can improve Luminexa.'
                )
            }
        )

    detail = (detail or '').strip()[:2000]
    if reason == ProviderDeletionFeedback.Reason.OTHER and not detail:
        raise ValidationError(
            {'deletion_detail': 'Please add a short note when selecting Other.'}
        )

    if channel not in {c.value for c in ProviderDeletionFeedback.Channel}:
        channel = ProviderDeletionFeedback.Channel.IN_APP

    snap = _provider_subscription_snapshot(user)
    return ProviderDeletionFeedback.objects.create(
        reason=reason,
        detail=detail,
        channel=channel,
        user_id_snapshot=user.pk,
        **snap,
    )


@transaction.atomic
def anonymize_user(user: User) -> bool:
    """Deactivate the account and scrub personal data. Idempotent.

    Returns True when the account was anonymized, False if it was already deleted.
    """
    if user.deleted_at is not None:
        return False

    original_email = user.email

    _deactivate_owned_organizations(user)

    user.is_active = False
    user.deleted_at = timezone.now()
    user.full_name = 'Deleted user'
    user.email = f'deleted+{user.pk}@deleted.luminex-a.com'
    user.phone = ''
    user.default_service_address = ''
    user.address_country = ''
    user.email_verified = False
    user.set_unusable_password()
    user.save()

    # Invalidate credentials and any pending sign-in codes for the old address.
    Token.objects.filter(user=user).delete()
    if original_email:
        LoginCode.objects.filter(email__iexact=original_email).delete()

    logger.info('Account %s anonymized on user request', user.pk)
    return True
