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

from .models import LoginCode, User

logger = logging.getLogger(__name__)


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
