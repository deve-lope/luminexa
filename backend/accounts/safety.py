"""Safety reports and chat blocks (Play Store UGC / 1:1 messaging)."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from businesses.models import Organization, OrganizationMembership
from jobs.permissions import is_org_staff

from .models import ChatBlock, SafetyReport, User


def _org_by_slug(slug: str) -> Organization:
    org = Organization.objects.filter(slug=(slug or '').strip()).first()
    if not org:
        raise ValidationError({'organization_slug': 'Organization not found.'})
    return org


def messaging_is_blocked(*, organization_id: int, customer_id: int) -> bool:
    return ChatBlock.objects.filter(
        organization_id=organization_id,
        customer_id=customer_id,
    ).exists()


def get_chat_block(*, organization_id: int, customer_id: int):
    return (
        ChatBlock.objects.filter(
            organization_id=organization_id,
            customer_id=customer_id,
        )
        .select_related('blocker')
        .first()
    )


def assert_messaging_allowed(*, organization, customer) -> None:
    if messaging_is_blocked(organization_id=organization.pk, customer_id=customer.pk):
        raise PermissionDenied(
            'Messaging is blocked for this conversation. You can still report the other party.'
        )


def create_safety_report(
    *,
    reporter: User,
    organization_slug: str,
    reason: str,
    detail: str,
    reported_user_id=None,
    conversation_id=None,
) -> SafetyReport:
    org = _org_by_slug(organization_slug)
    detail_text = (detail or '').strip()
    if len(detail_text) < 20:
        raise ValidationError({'detail': 'Please describe what happened (at least 20 characters).'})
    if len(detail_text) > 2000:
        raise ValidationError({'detail': 'Details must be 2000 characters or fewer.'})
    if reason not in SafetyReport.Reason.values:
        raise ValidationError({'reason': 'Invalid reason.'})

    reporter_is_staff = is_org_staff(reporter, org)
    reported_user = None

    if reporter_is_staff:
        if reported_user_id is None:
            raise ValidationError({'reported_user_id': 'Select the customer to report.'})
        try:
            reported_user_id = int(reported_user_id)
        except (TypeError, ValueError):
            raise ValidationError({'reported_user_id': 'Invalid user id.'}) from None
        if reported_user_id == reporter.id:
            raise ValidationError({'reported_user_id': 'You cannot report yourself.'})
        reported_user = User.objects.filter(pk=reported_user_id, is_active=True).first()
        if not reported_user:
            raise ValidationError({'reported_user_id': 'User not found.'})

        related = OrganizationMembership.objects.filter(
            organization=org,
            user=reported_user,
            role=OrganizationMembership.Role.CUSTOMER,
        ).exists()
        if not related:
            from jobs.models import OrgCustomerConversation

            related = OrgCustomerConversation.objects.filter(
                organization=org,
                customer=reported_user,
            ).exists()
        if not related:
            raise ValidationError({'reported_user_id': 'That customer is not linked to this business.'})
    else:
        # Customer reports the business profile.
        reported_user = None

    day_ago = timezone.now() - timedelta(hours=24)
    recent_qs = SafetyReport.objects.filter(reporter=reporter, created_at__gte=day_ago)
    if reported_user:
        recent_qs = recent_qs.filter(reported_user=reported_user, reported_organization=org)
    else:
        recent_qs = recent_qs.filter(reported_organization=org, reported_user__isnull=True)
    if recent_qs.exists():
        raise ValidationError(
            {'detail': 'You already submitted a report for this account in the last 24 hours.'}
        )

    conv_id = None
    if conversation_id is not None and str(conversation_id).strip() != '':
        try:
            conv_id = int(conversation_id)
        except (TypeError, ValueError):
            raise ValidationError({'conversation_id': 'Invalid conversation id.'}) from None

    return SafetyReport.objects.create(
        reporter=reporter,
        reported_organization=org,
        reported_user=reported_user,
        reason=reason,
        detail=detail_text,
        conversation_id=conv_id,
        status=SafetyReport.Status.OPEN,
    )


def create_chat_block(
    *,
    blocker: User,
    organization_slug: str,
    customer_id=None,
) -> ChatBlock:
    org = _org_by_slug(organization_slug)
    if is_org_staff(blocker, org):
        if customer_id is None:
            raise ValidationError({'customer_id': 'customer_id is required.'})
        try:
            customer_id = int(customer_id)
        except (TypeError, ValueError):
            raise ValidationError({'customer_id': 'Invalid customer id.'}) from None
        customer = User.objects.filter(pk=customer_id, is_active=True).first()
        if not customer:
            raise ValidationError({'customer_id': 'Customer not found.'})
        if customer_id == blocker.id:
            raise ValidationError({'customer_id': 'You cannot block yourself.'})
    else:
        customer_id = blocker.id

    existing = get_chat_block(organization_id=org.pk, customer_id=customer_id)
    if existing:
        return existing

    return ChatBlock.objects.create(
        organization=org,
        customer_id=customer_id,
        blocker=blocker,
    )


def remove_chat_block(
    *,
    actor: User,
    organization_slug: str,
    customer_id=None,
) -> bool:
    """Return True if a block was removed."""
    org = _org_by_slug(organization_slug)
    if is_org_staff(actor, org):
        if customer_id is None:
            raise ValidationError({'customer_id': 'customer_id is required.'})
        try:
            customer_id = int(customer_id)
        except (TypeError, ValueError):
            raise ValidationError({'customer_id': 'Invalid customer id.'}) from None
    else:
        customer_id = actor.id

    block = get_chat_block(organization_id=org.pk, customer_id=customer_id)
    if not block:
        return False
    if block.blocker_id == actor.id:
        block.delete()
        return True
    if is_org_staff(actor, org) and is_org_staff(block.blocker, org):
        block.delete()
        return True
    raise PermissionDenied('Only the person who blocked can unblock this conversation.')


def chat_block_payload(*, organization, customer, viewer) -> dict:
    block = get_chat_block(organization_id=organization.pk, customer_id=customer.pk)
    if not block:
        return {
            'messaging_blocked': False,
            'blocked_by_me': False,
            'blocker_is_customer': None,
        }
    return {
        'messaging_blocked': True,
        'blocked_by_me': block.blocker_id == viewer.id,
        'blocker_is_customer': block.blocker_id == customer.id,
    }
