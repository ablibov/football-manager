"""Caspian Match Simulator URL configuration. API reference: docs/API.md"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.throttling import ScopedRateThrottle

from .spa import spa


class ThrottledObtainAuthToken(ObtainAuthToken):
    """Admin token login, limited to 10 attempts per minute per client against brute force."""
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'


def media(request, path):
    """Uploaded media with a locked-down policy: an opened SVG can never run scripts on this origin."""
    resp = serve(request, path, document_root=settings.MEDIA_ROOT)
    resp['Content-Security-Policy'] = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
    resp['X-Content-Type-Options'] = 'nosniff'
    return resp

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('api/auth/token/', ThrottledObtainAuthToken.as_view()),
    # uploaded media (licensed crests/kits) and Django admin static files
    re_path(r'^media/(?P<path>.*)$', media),
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
    # everything else: the React app
    re_path(r'^(?P<path>(?!api/|admin/|media/|static/).*)$', spa),
]
