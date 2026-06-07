from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User

from .models import OrganizationMembership, StaffInvitation


class AcceptStaffInviteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = (request.data.get('token') or request.query_params.get('token') or '').strip()
        if not token:
            raise ValidationError({'token': 'Required.'})
        invite = StaffInvitation.objects.filter(token=token, accepted_at__isnull=True).select_related(
            'organization',
        ).first()
        if not invite:
            raise ValidationError({'detail': 'Invalid or expired invitation.'})
        if request.user.email.lower() != invite.email.lower():
            raise PermissionDenied('Sign in with the email address that received the invitation.')
        OrganizationMembership.objects.update_or_create(
            organization=invite.organization,
            user=request.user,
            defaults={'role': OrganizationMembership.Role.STAFF},
        )
        invite.accepted_at = timezone.now()
        invite.save(update_fields=['accepted_at'])
        return Response({
            'detail': f'You joined {invite.organization.name} as staff.',
            'organization_slug': invite.organization.slug,
        })
