from django.conf import settings
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class CookieTokenAuthentication(TokenAuthentication):
    """
    Authenticate via HttpOnly auth cookie (preferred for the SPA), falling back
    to the standard Authorization: Token header for API clients and tests.
    """

    def authenticate(self, request):
        header_auth = super().authenticate(request)
        if header_auth is not None:
            return header_auth

        raw = request.COOKIES.get(settings.AUTH_TOKEN_COOKIE_NAME)
        if not raw:
            return None
        try:
            return self.authenticate_credentials(raw)
        except AuthenticationFailed:
            # HttpOnly cookies cannot be cleared by the SPA. Treat a stale
            # rotated/deleted cookie as signed out so public login endpoints
            # can issue fresh credentials. Protected endpoints still return
            # 401 through their IsAuthenticated permission.
            return None
