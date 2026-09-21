"""Issue and prune per-device auth tokens (max two simultaneous logins)."""

from django.conf import settings
from django.db import transaction
from rest_framework.response import Response

from .auth_cookies import set_auth_cookie
from .models import AuthToken, User
from .serializers import UserSerializer


def max_concurrent_sessions() -> int:
    return max(1, int(getattr(settings, 'AUTH_MAX_CONCURRENT_SESSIONS', 2)))


def auth_token_key_from_request(request) -> str:
    if request is None:
        return ''
    header = request.META.get('HTTP_AUTHORIZATION') or ''
    if header.lower().startswith('token '):
        return header.split(' ', 1)[1].strip()
    cookie_name = getattr(settings, 'AUTH_TOKEN_COOKIE_NAME', 'lx_auth')
    return (request.COOKIES.get(cookie_name) or '').strip()


def prune_extra_auth_tokens(user, *, keep: AuthToken) -> None:
    extras = (
        AuthToken.objects.filter(user=user)
        .exclude(pk=keep.pk)
        .order_by('created', 'pk')
    )
    overflow = extras.count() + 1 - max_concurrent_sessions()
    if overflow > 0:
        ids = list(extras.values_list('pk', flat=True)[:overflow])
        AuthToken.objects.filter(pk__in=ids).delete()


def issue_auth_token_response(user, request=None):
    """Create or reuse a device token and set the HttpOnly cookie (not in JSON)."""
    existing_key = auth_token_key_from_request(request)
    with transaction.atomic():
        locked = User.objects.select_for_update().get(pk=user.pk)
        existing = (
            AuthToken.objects.filter(user=locked, key=existing_key).first()
            if existing_key
            else None
        )
        if existing:
            token = existing
        else:
            token = AuthToken.objects.create(user=locked)
            prune_extra_auth_tokens(locked, keep=token)
    response = Response({
        'user': UserSerializer(user).data,
        'auth': 'cookie',
    })
    set_auth_cookie(response, token.key)
    return response


def delete_request_auth_token(request) -> None:
    """Sign out only this device; other sessions stay active."""
    token = getattr(request, 'auth', None)
    if isinstance(token, AuthToken):
        token.delete()
        return
    key = auth_token_key_from_request(request)
    user = getattr(request, 'user', None)
    if key and getattr(user, 'is_authenticated', False):
        AuthToken.objects.filter(user=user, key=key).delete()


def delete_all_auth_tokens(user) -> None:
    AuthToken.objects.filter(user=user).delete()
