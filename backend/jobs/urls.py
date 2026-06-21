from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import dashboard_views, public_views, service_request_views, views

router = DefaultRouter()
router.register(r'organizations', views.OrganizationViewSet, basename='organization')
router.register(r'service-categories', views.ServiceCategoryViewSet, basename='service-category')
router.register(r'services', views.ServiceViewSet, basename='service')
router.register(r'availability-slots', views.AvailabilitySlotViewSet, basename='availability-slot')
router.register(r'unavailable-blocks', views.UnavailableBlockViewSet, basename='unavailable-block')
router.register(r'bookings', views.BookingViewSet, basename='booking')
router.register(r'tasks', views.TaskViewSet, basename='task')

urlpatterns = [
    path('me/service-inquiries/', views.CustomerMyInquiriesAPIView.as_view()),
    path('provider-dashboard/', dashboard_views.ProviderDashboardAPIView.as_view()),
    path('provider-service-requests/', service_request_views.ProviderServiceRequestsAPIView.as_view()),
    path(
        'organizations/<slug:slug>/service-inquiries/<int:inquiry_id>/',
        service_request_views.ProviderServiceInquiryDetailAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/service-inquiries/<int:inquiry_id>/messages/',
        service_request_views.ServiceInquiryMessagesAPIView.as_view(),
    ),
    path('public/providers/<slug>/', public_views.PublicProviderStorefrontAPIView.as_view()),
    path(
        'public/providers/<slug>/services/<int:service_id>/',
        public_views.PublicServiceDetailAPIView.as_view(),
        name='public-service-detail',
    ),
    path(
        'public/providers/<slug>/services/<int:service_id>/reviews/',
        public_views.PublicServiceReviewAPIView.as_view(),
        name='public-service-reviews',
    ),
    path(
        'public/providers/<slug>/services/<int:service_id>/calendar/',
        public_views.PublicServiceCalendarAPIView.as_view(),
        name='public-service-calendar',
    ),
    path('', include(router.urls)),
]
