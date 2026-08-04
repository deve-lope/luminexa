from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import analytics_views, dashboard_views, public_views, service_request_views, stripe_views, views
from . import quickbooks_views

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
    path('me/conversations/', views.CustomerConversationsAPIView.as_view()),
    path('me/notifications/', views.CustomerNotificationsAPIView.as_view()),
    path(
        'me/notifications/dismiss-all/',
        views.CustomerNotificationsDismissAllAPIView.as_view(),
    ),
    path(
        'me/notifications/<int:notification_id>/dismiss/',
        views.CustomerNotificationDismissAPIView.as_view(),
    ),
    path('provider-dashboard/', dashboard_views.ProviderDashboardAPIView.as_view()),
    path('provider-analytics/', analytics_views.ProviderAnalyticsAPIView.as_view()),
    path('provider-books-export/', analytics_views.ProviderBooksExportAPIView.as_view()),
    path('provider-service-requests/', service_request_views.ProviderServiceRequestsAPIView.as_view()),
    path(
        'organizations/<slug:slug>/service-inquiries/<int:inquiry_id>/',
        service_request_views.ProviderServiceInquiryDetailAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/service-inquiries/<int:inquiry_id>/messages/',
        service_request_views.ServiceInquiryMessagesAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/billing/',
        stripe_views.OrgBillingSummaryAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/billing/connect/onboard/',
        stripe_views.ConnectOnboardingAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/billing/connect/login/',
        stripe_views.ConnectLoginAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/billing/subscribe/',
        stripe_views.SubscriptionCheckoutAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/billing/portal/',
        stripe_views.BillingPortalAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/billing/sync-checkout/',
        stripe_views.SyncCheckoutSessionAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/billing/instant-payout/',
        stripe_views.InstantPayoutAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/accounting/quickbooks/connect/',
        quickbooks_views.QuickBooksConnectAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/accounting/quickbooks/disconnect/',
        quickbooks_views.QuickBooksDisconnectAPIView.as_view(),
    ),
    path(
        'organizations/<slug:slug>/accounting/quickbooks/sync/',
        quickbooks_views.QuickBooksSyncAPIView.as_view(),
    ),
    path(
        'accounting/quickbooks/callback/',
        quickbooks_views.QuickBooksCallbackAPIView.as_view(),
    ),
    path(
        'bookings/<int:pk>/invoice/pay/',
        stripe_views.InvoicePayCheckoutAPIView.as_view(),
    ),
    path(
        'bookings/<int:pk>/invoice/pay/sync/',
        stripe_views.InvoicePaySyncAPIView.as_view(),
    ),
    path(
        'me/unpaid-invoice/',
        stripe_views.CustomerUnpaidInvoiceAPIView.as_view(),
    ),
    path('webhooks/stripe/', stripe_views.stripe_webhook),
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
    path(
        'public/providers/<slug>/combined-calendar/',
        public_views.PublicCombinedCalendarAPIView.as_view(),
        name='public-combined-calendar',
    ),
    path('', include(router.urls)),
]
