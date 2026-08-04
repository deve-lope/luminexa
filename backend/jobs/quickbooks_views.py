"""QuickBooks Online connect / disconnect / sync endpoints."""

from __future__ import annotations

import hashlib
import hmac
import secrets

from django.conf import settings
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.models import Organization, OrganizationMembership

from . import quickbooks_services, stripe_services
from .permissions import membership_for


def _org_for_owner(user, slug: str) -> Organization:
    org = get_object_or_404(Organization, slug=slug)
    m = membership_for(user, org)
    if not m or m.role != OrganizationMembership.Role.OWNER:
        raise PermissionDenied('Only the business owner can manage QuickBooks.')
    return org


def _sign_state(org_id: int, nonce: str) -> str:
    secret = (getattr(settings, 'SECRET_KEY', '') or 'luminexa').encode()
    digest = hmac.new(secret, f'{org_id}:{nonce}'.encode(), hashlib.sha256).hexdigest()[:20]
    return f'{org_id}.{nonce}.{digest}'


def _parse_state(state: str):
    parts = (state or '').split('.')
    if len(parts) != 3:
        return None, None
    org_id_s, nonce, digest = parts
    try:
        org_id = int(org_id_s)
    except (TypeError, ValueError):
        return None, None
    expected = _sign_state(org_id, nonce)
    if not hmac.compare_digest(expected, state):
        return None, None
    return org_id, nonce


class QuickBooksConnectAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        org = _org_for_owner(request.user, slug)
        state = _sign_state(org.id, secrets.token_urlsafe(12))
        url = quickbooks_services.build_connect_url(org=org, state=state)
        return Response({'url': url})


class QuickBooksCallbackAPIView(APIView):
    """Intuit redirects here with ?code=&realmId=&state=."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        error = request.query_params.get('error')
        code = request.query_params.get('code')
        realm_id = request.query_params.get('realmId') or request.query_params.get('realm_id')
        state = request.query_params.get('state') or ''
        org_id, _nonce = _parse_state(state)
        org = Organization.objects.filter(pk=org_id).first() if org_id else None

        base = (getattr(settings, 'PUBLIC_APP_URL', None) or 'http://localhost:3000').rstrip('/')
        settings_path = (
            f'{base}/provider/{org.slug}/settings' if org else f'{base}/'
        )

        if error:
            return HttpResponseRedirect(f'{settings_path}?qbo=error')
        if not code or not realm_id or not org:
            return HttpResponseRedirect(f'{settings_path}?qbo=invalid')

        try:
            quickbooks_services.exchange_code_for_tokens(
                org=org, code=code, realm_id=realm_id,
            )
        except Exception:
            return HttpResponseRedirect(f'{settings_path}?qbo=token_error')

        return HttpResponseRedirect(f'{settings_path}?qbo=1')


class QuickBooksDisconnectAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        org = _org_for_owner(request.user, slug)
        quickbooks_services.disconnect_qbo(org)
        return Response(stripe_services.billing_summary(org))


class QuickBooksSyncAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        org = _org_for_owner(request.user, slug)
        result = quickbooks_services.sync_org_recent_invoices(org)
        return Response({
            **result,
            'billing': stripe_services.billing_summary(org),
        })
