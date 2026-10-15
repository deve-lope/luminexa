from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import OrganizationMembership, StaffInvitation


class AcceptStaffInviteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        if not token:
            raise ValidationError({'token': 'Required.'})
        invite = StaffInvitation.objects.filter(token=token, accepted_at__isnull=True).select_related(
            'organization',
        ).first()
        if not invite:
            raise ValidationError({'detail': 'Invalid or expired invitation.'})
        if request.user.email.lower() != invite.email.lower():
            raise PermissionDenied('Sign in with the email address that received the invitation.')
        org = invite.organization
        role = invite.role or OrganizationMembership.Role.STAFF
        if role not in (
            OrganizationMembership.Role.STAFF,
            OrganizationMembership.Role.CREW,
        ):
            role = OrganizationMembership.Role.STAFF

        if role == OrganizationMembership.Role.STAFF:
            already = OrganizationMembership.objects.filter(
                organization=org,
                user=request.user,
                role=OrganizationMembership.Role.STAFF,
            ).exists()
            if (
                not already
                and OrganizationMembership.staff_count(org)
                >= OrganizationMembership.MAX_STAFF_PER_ORGANIZATION
            ):
                raise ValidationError({
                    'detail': (
                        f'This business has reached its limit of '
                        f'{OrganizationMembership.MAX_STAFF_PER_ORGANIZATION} staff members.'
                    ),
                    'code': 'staff_limit_reached',
                })
        else:
            already = OrganizationMembership.objects.filter(
                organization=org,
                user=request.user,
                role=OrganizationMembership.Role.CREW,
            ).exists()
            if (
                not already
                and OrganizationMembership.crew_count(org)
                >= OrganizationMembership.crew_seats_allowed(org)
            ):
                raise ValidationError({
                    'detail': (
                        'This business has no free crew seats. '
                        'Ask the owner to add seats or remove a crew member.'
                    ),
                    'code': 'crew_limit_reached',
                })

        OrganizationMembership.objects.update_or_create(
            organization=org,
            user=request.user,
            defaults={'role': role},
        )
        invite.accepted_at = timezone.now()
        invite.save(update_fields=['accepted_at'])
        label = 'crew' if role == OrganizationMembership.Role.CREW else 'staff'
        return Response({
            'detail': f'You joined {invite.organization.name} as {label}.',
            'organization_slug': invite.organization.slug,
            'role': role,
        })
