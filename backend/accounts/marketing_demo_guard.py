"""Server-side fence for the public marketing demo owner session."""

from __future__ import annotations

import json

from django.conf import settings
from django.http import HttpResponse

from .otp import is_marketing_demo_user

# Writes that must always work for the demo session.
_ALLOWED_WRITE_PREFIXES = (
    '/accounts/api/logout',
    '/accounts/api/login/marketing-demo',
)

# Demo may explore the product (bookings/messages/tasks) but not leave the sandbox.
_BLOCKED_WRITE_PREFIXES = (
    '/accounts/api/account/delete',
    '/accounts/api/change-password',
    '/accounts/api/password-reset',
    '/accounts/api/forgot-password',
    '/accounts/api/reset-password',
    '/accounts/api/profile',  # no PII edits on shared owner
    '/api/v1/organizations/',  # billing/connect, staff invite, org settings
    '/api/v1/stripe',
    '/api/v1/quickbooks',
    '/api/v1/qbo',
)


def _normalize_path(path: str) -> str:
    if not path:
        return '/'
    # Keep trailing structure stable for prefix checks.
    return path.split('?', 1)[0]


def marketing_demo_write_allowed(path: str) -> bool:
    """Return True if a marketing-demo user may mutate this path."""
    p = _normalize_path(path)
    for prefix in _ALLOWED_WRITE_PREFIXES:
        if p == prefix or p.startswith(prefix + '/') or p.rstrip('/') == prefix.rstrip('/'):
            return True
    for prefix in _BLOCKED_WRITE_PREFIXES:
        if p == prefix or p.startswith(prefix) or p.rstrip('/').startswith(prefix.rstrip('/')):
            return False
    # Default: allow in-product demo exploration (bookings, messages, slots, etc.).
    # Seed refresh restores vandalized demo data; billing/delete/org remain blocked.
    return True


def authenticate_user_from_request(request):
    """Resolve the SPA cookie/header token user (DRF auth is not on Django request.user)."""
    from rest_framework.exceptions import AuthenticationFailed

    from .authentication import CookieTokenAuthentication

    try:
        result = CookieTokenAuthentication().authenticate(request)
    except AuthenticationFailed:
        return None
    if not result:
        return None
    return result[0]


class MarketingDemoWriteGuardMiddleware:
    """
    Block dangerous mutating API calls for the shared marketing demo owner.
    Frontend is_marketing_demo flags are not a security boundary.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            user = authenticate_user_from_request(request)
            if user is not None and is_marketing_demo_user(user):
                if not marketing_demo_write_allowed(request.path):
                    body = json.dumps(
                        {
                            'detail': (
                                'This action is disabled in the public demo. '
                                'Start a free trial to use it on your own account.'
                            ),
                            'code': 'marketing_demo_readonly',
                        }
                    )
                    return HttpResponse(
                        body,
                        status=403,
                        content_type='application/json',
                    )
        return self.get_response(request)
