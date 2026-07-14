"""Authenticated media serving with a public whitelist for storefront assets."""

from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpResponseForbidden
from django.views.static import serve as django_serve
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed

from accounts.authentication import CookieTokenAuthentication

# Intentionally public marketing / storefront assets (shown on public pages).
PUBLIC_MEDIA_PREFIXES = (
    'orgs/logos/',
    'orgs/banners/',
    'orgs/gallery/',
    'services/public/',
    'services/gallery/',
)


def _is_public_media_path(path: str) -> bool:
    normalized = (path or '').lstrip('/')
    if not normalized or '..' in Path(normalized).parts:
        return False
    return any(normalized.startswith(prefix) for prefix in PUBLIC_MEDIA_PREFIXES)


def _user_is_authenticated(request) -> bool:
    authenticators = (CookieTokenAuthentication(), TokenAuthentication())
    for authenticator in authenticators:
        try:
            result = authenticator.authenticate(request)
        except AuthenticationFailed:
            continue
        if result is not None:
            request.user = result[0]
            return True
    return bool(getattr(request.user, 'is_authenticated', False))


def serve_media(request, path, document_root=None, show_indexes=False):
    """
    Serve media files. Public storefront prefixes are open; everything else
    requires a valid auth cookie or Token header.
    """
    document_root = document_root or settings.MEDIA_ROOT
    if not _is_public_media_path(path) and not _user_is_authenticated(request):
        return HttpResponseForbidden('Authentication required.')
    try:
        return django_serve(
            request,
            path,
            document_root=document_root,
            show_indexes=show_indexes,
        )
    except Http404:
        raise
