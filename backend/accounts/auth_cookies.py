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
    # expire via set_cookie so Secure/SameSite match the live cookie. Django 5.2
    # delete_cookie() cannot take secure= and will not clear a Secure lx_auth cookie.
    response.set_cookie(
        settings.AUTH_TOKEN_COOKIE_NAME,
        '',
        max_age=0,
        httponly=True,
        secure=bool(settings.AUTH_TOKEN_COOKIE_SECURE),
        samesite=settings.AUTH_TOKEN_COOKIE_SAMESITE,
        path='/',
        expires='Thu, 01 Jan 1970 00:00:00 GMT',
    )
    return response
