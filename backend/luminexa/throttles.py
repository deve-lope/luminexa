from rest_framework.throttling import ScopedRateThrottle


class LoginThrottle(ScopedRateThrottle):
    scope = 'login'


class PasswordResetThrottle(ScopedRateThrottle):
    scope = 'password_reset'


class BookingCreateThrottle(ScopedRateThrottle):
    scope = 'booking_create'


class ServiceInquiryThrottle(ScopedRateThrottle):
    scope = 'service_inquiry'


class RegisterBusinessThrottle(ScopedRateThrottle):
    scope = 'register_business'


class MapSearchThrottle(ScopedRateThrottle):
    scope = 'map_search'


class BusinessTypeWriteThrottle(ScopedRateThrottle):
    scope = 'business_type_write'
