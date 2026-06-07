from django.urls import path

from . import api_views
from .staff_invite_views import AcceptStaffInviteAPIView

urlpatterns = [
    path('accept-staff-invite/', AcceptStaffInviteAPIView.as_view(), name='accept-staff-invite'),
    path('public/services/', api_views.public_services_browse_api, name='public-services-browse'),
    path('customer/home/', api_views.customer_home_api, name='customer-home'),
    path('customer/services/', api_views.customer_services_catalog_api, name='customer-services-catalog'),
    path('customer/discover/', api_views.customer_discover_api, name='customer-discover'),
    path('postal-lookup/', api_views.postal_lookup_api, name='postal-lookup'),
    path('reverse-geocode/', api_views.reverse_geocode_api, name='reverse-geocode'),
    path('map-search/', api_views.map_search_api, name='map-search'),
    path('me/memberships/', api_views.my_memberships_api, name='my-memberships'),
    path('business-types/', api_views.business_types_list_api, name='business-types-list'),
    path(
        'business-types/<slug:slug>/providers/',
        api_views.business_type_providers_api,
        name='business-type-providers',
    ),
]
