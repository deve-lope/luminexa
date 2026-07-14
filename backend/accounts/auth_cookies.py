from django.conf import settings


def set_auth_cookie(response, token_key: str):
    response.set_cookie(
        settings.AUTH_TOKEN_COOKIE_NAME,
        token_key,
        max_age=int(settings.AUTH_TOKEN_COOKIE_MAX_AGE),
        httponly=True,
        secure=bool(settings.AUTH_TOKEN_COOKIE_SECURE),
        samesite=settings.AUTH_TOKEN_COOKIE_SAMESITE,
        path='/',
    )
    return response


def clear_auth_cookie(response):
    response.delete_cookie(
        settings.AUTH_TOKEN_COOKIE_NAME,
        path='/',
        samesite=settings.AUTH_TOKEN_COOKIE_SAMESITE,
    )
    return response
