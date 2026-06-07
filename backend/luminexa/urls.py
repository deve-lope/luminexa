from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponseRedirect
from django.urls import include, path, re_path
from django.views.static import serve as serve_media


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

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif settings.SERVE_MEDIA:
    # django.conf.urls.static.static() is a no-op when DEBUG=False
    urlpatterns += [
        re_path(
            r'^media/(?P<path>.*)$',
            serve_media,
            {'document_root': settings.MEDIA_ROOT},
        ),
    ]
