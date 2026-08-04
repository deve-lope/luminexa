from django.conf import settings


def public_app_url(request):
    return {'PUBLIC_APP_URL': getattr(settings, 'PUBLIC_APP_URL', 'https://app.luminex-a.com').rstrip('/')}
