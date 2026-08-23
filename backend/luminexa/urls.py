from django.conf import settings
from django.contrib import admin
from django.http import HttpResponseRedirect
from django.urls import include, path, re_path
from two_factor.urls import urlpatterns as tf_urls

from luminexa.media_views import serve_media


def api_root_redirect(request):
    """Port 9001 is the API only — send browsers to the React app."""
    return HttpResponseRedirect(settings.PUBLIC_APP_URL.rstrip('/') + '/login')


urlpatterns = [
    path('', api_root_redirect),
    path('', include(tf_urls)),
    path('admin/', admin.site.urls),
    path('accounts/', include('accounts.urls')),
    path('api/v1/', include('businesses.urls')),
    path('api/v1/', include('jobs.urls')),
]

if settings.DEBUG or settings.SERVE_MEDIA:
    urlpatterns += [
        # No document_root kwarg: serve_media reads MEDIA_ROOT per request, so
        # it is not frozen into the URLconf at import time.
        re_path(r'^media/(?P<path>.*)$', serve_media),
    ]
