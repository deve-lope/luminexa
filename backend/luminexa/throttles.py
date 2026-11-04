from rest_framework.throttling import SimpleRateThrottle

from accounts.owner_alerts import record_rate_limit_hit


class AlertingSimpleRateThrottle(SimpleRateThrottle):
    """IP-based throttle that emails the owner (throttled) when a limit is hit.

    Uses SimpleRateThrottle rather than ScopedRateThrottle: the latter only
    applies when the *view* sets ``throttle_scope``, so classes like
    ``LoginThrottle`` with a class-level ``scope`` were previously no-ops.
    """

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        if ident is None:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': ident}

    def allow_request(self, request, view):
        allowed = super().allow_request(request, view)
        if not allowed:
            record_rate_limit_hit(request, scope=getattr(self, 'scope', '') or '')
        return allowed


class LoginThrottle(AlertingSimpleRateThrottle):
    scope = 'login'


class RegisterThrottle(AlertingSimpleRateThrottle):
    scope = 'register'


class PasswordResetThrottle(AlertingSimpleRateThrottle):
    scope = 'password_reset'


class BookingCreateThrottle(AlertingSimpleRateThrottle):
    scope = 'booking_create'


class ServiceInquiryThrottle(AlertingSimpleRateThrottle):
    scope = 'service_inquiry'


class RegisterBusinessThrottle(AlertingSimpleRateThrottle):
    scope = 'register_business'


class MapSearchThrottle(AlertingSimpleRateThrottle):
    scope = 'map_search'


class BusinessTypeWriteThrottle(AlertingSimpleRateThrottle):
    scope = 'business_type_write'
