from django.conf import settings
from django.contrib import admin
from django.http import HttpResponseRedirect
from django.urls import include, path, re_path

from luminexa.media_views import serve_media


def api_root_redirect(request):
    """Port 9001 is the API only — send browsers to the React app."""
    return HttpResponseRedirect(settings.PUBLIC_APP_URL.rstrip('/') + '/login')


urlpatterns = [
    path('', api_root_redirect),
    path('admin/', admin.site.urls),
    path('accounts/', include('accounts.urls')),
    path('api/v1/', include('businesses.urls')),
    path('api/v1/', include('jobs.urls')),
]

if settings.DEBUG or settings.SERVE_MEDIA:
    urlpatterns += [
        re_path(
            r'^media/(?P<path>.*)$',
            serve_media,
            {'document_root': settings.MEDIA_ROOT},
        ),
    ]
