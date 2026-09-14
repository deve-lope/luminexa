"""Django admin (/account/login/) failed-attempt lockout — 10 per day."""

from __future__ import annotations

import logging
from datetime import date

from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

ADMIN_LOGIN_MAX_FAILURES_PER_DAY = 10


def utc_today() -> date:
    return timezone.now().date()


def normalize_email(email: str) -> str:
    return (email or '').strip().lower()


def client_ip(request) -> str:
    if request is None:
        return ''
    forwarded = (request.META.get('HTTP_X_FORWARDED_FOR') or '').strip()
    if forwarded:
        return forwarded.split(',')[0].strip()[:64]
    return (request.META.get('REMOTE_ADDR') or '').strip()[:64]


def _keys(*, email: str = '', ip: str = '') -> list[str]:
    keys = []
    email_n = normalize_email(email)
    if email_n:
        keys.append(f'email:{email_n}')
    ip_n = (ip or '').strip()
    if ip_n:
        keys.append(f'ip:{ip_n}')
    return keys


def admin_login_is_locked(*, email: str = '', ip: str = '', day: date | None = None) -> bool:
    from .models import AdminLoginFailureDay

    day = day or utc_today()
    keys = _keys(email=email, ip=ip)
    if not keys:
        return False
    return AdminLoginFailureDay.objects.filter(
        key__in=keys,
        day=day,
        fail_count__gte=ADMIN_LOGIN_MAX_FAILURES_PER_DAY,
    ).exists()


@transaction.atomic
def record_admin_login_failure(*, email: str = '', ip: str = '', request=None) -> None:
    """Increment today's fail counters; email support once when a key hits the cap."""
    from .models import AdminLoginFailureDay

    if request is not None and not ip:
        ip = client_ip(request)
    day = utc_today()
    keys = _keys(email=email, ip=ip)
    if not keys:
        return

    alert_payload = None
    for key in keys:
        row, _ = AdminLoginFailureDay.objects.select_for_update().get_or_create(
            key=key,
            day=day,
            defaults={'fail_count': 0},
        )
        if row.fail_count >= ADMIN_LOGIN_MAX_FAILURES_PER_DAY:
            continue
        row.fail_count += 1
        update_fields = ['fail_count', 'updated_at']
        if (
            row.fail_count >= ADMIN_LOGIN_MAX_FAILURES_PER_DAY
            and row.alert_sent_at is None
        ):
            row.alert_sent_at = timezone.now()
            update_fields.append('alert_sent_at')
            if alert_payload is None:
                alert_payload = {
                    'key': key,
                    'email': email,
                    'ip': ip,
                    'fail_count': row.fail_count,
                }
        row.save(update_fields=update_fields)

    if alert_payload:
        _send_lockout_alert(**alert_payload)


def clear_admin_login_lockout(*, email: str = '', ip: str = '') -> int:
    """Clear today's counters for the given email and/or IP. Returns rows deleted."""
    from .models import AdminLoginFailureDay

    keys = _keys(email=email, ip=ip)
    if not keys:
        return 0
    deleted, _ = AdminLoginFailureDay.objects.filter(key__in=keys, day=utc_today()).delete()
    return deleted


def _send_lockout_alert(*, key: str, email: str, ip: str, fail_count: int) -> None:
    from .emails import send_admin_login_lockout_alert

    try:
        send_admin_login_lockout_alert(
            key=key,
            attempted_email=normalize_email(email),
            ip=ip or '',
            fail_count=fail_count,
            day=utc_today(),
        )
    except Exception:
        logger.exception('Failed to send admin login lockout alert for %s', key)


def lockout_message() -> str:
    return (
        'Too many failed admin login attempts for today. '
        'Try again tomorrow, or ask a platform operator to clear the lockout.'
    )
