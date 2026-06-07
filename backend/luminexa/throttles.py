from rest_framework.throttling import ScopedRateThrottle


class LoginThrottle(ScopedRateThrottle):
    scope = 'login'


class PasswordResetThrottle(ScopedRateThrottle):
    scope = 'password_reset'


class BookingCreateThrottle(ScopedRateThrottle):
    scope = 'booking_create'


class ServiceInquiryThrottle(ScopedRateThrottle):
    scope = 'service_inquiry'
