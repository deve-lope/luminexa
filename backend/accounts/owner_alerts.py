"""Owner-facing emails: new accounts and throttled security alerts.

Uses Django's existing EMAIL_* / DEFAULT_FROM_EMAIL setup (SMTP, Brevo, Mailpit,
or the console backend). Disabled when OWNER_ALERT_EMAIL is empty.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger('luminexa.security')


def owner_alert_recipient() -> str:
    return (getattr(settings, 'OWNER_ALERT_EMAIL', '') or '').strip()


def get_client_ip(request) -> str:
    """Prefer Cloudflare's connecting IP, then X-Forwarded-For, then REMOTE_ADDR."""
    if request is None:
        return 'unknown'
    cf = (request.META.get('HTTP_CF_CONNECTING_IP') or '').strip()
    if cf:
        return cf.split(',')[0].strip()
    xff = (request.META.get('HTTP_X_FORWARDED_FOR') or '').strip()
    if xff:
        return xff.split(',')[0].strip()
    return (request.META.get('REMOTE_ADDR') or '').strip() or 'unknown'


def send_owner_alert(subject: str, body: str, *, throttle_key: str | None = None, throttle_seconds: int = 3600) -> bool:
    """Send an email to OWNER_ALERT_EMAIL. throttle_key suppresses repeats."""
    to = owner_alert_recipient()
    if not to:
        return False
    if throttle_key:
        cache_key = f'lx-owner-alert:{throttle_key}'
        if not cache.add(cache_key, 1, timeout=throttle_seconds):
            logger.info('Suppressed duplicate owner alert %s', throttle_key)
            return False
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception('Failed to send owner alert: %s', subject)
        return False


def send_new_account_alert(user, *, account_type: str, organization=None) -> bool:
    """One email per new account. No password, OTP, phone, or address."""
    created = timezone.now().isoformat()
    lines = [
        'A new Luminexa account was created.',
        '',
        f'Account type: {account_type}',
        f'Timestamp (UTC): {created}',
        f'Account id: {getattr(user, "public_ref", "") or user.pk}',
        f'Email: {user.email}',
    ]
    if organization is not None:
        lines.append(f'Business: {organization.name} ({organization.slug})')
    lines.extend([
        '',
        'Login codes and credentials are not included.',
    ])
    subject = f'Luminexa: new {account_type} account'
    logger.info('New account %s type=%s ref=%s', user.email, account_type, getattr(user, 'public_ref', ''))
    return send_owner_alert(subject, '\n'.join(lines))


def bump_counter(key: str, window: int) -> int:
    n = cache.get(key) or 0
    n = int(n) + 1
    cache.set(key, n, timeout=window)
    return n


def maybe_threshold_alert(
    *,
    kind: str,
    ident: str,
    threshold: int,
    window: int,
    subject: str,
    body: str,
    throttle_seconds: int | None = None,
) -> int:
    count = bump_counter(f'lx-sec-count:{kind}:{ident}', window)
    if count == threshold:
        send_owner_alert(
            subject,
            body + f'\n\nCount in window: {count} (threshold {threshold} / {window}s).',
            throttle_key=f'{kind}:{ident}',
            throttle_seconds=throttle_seconds or max(window * 2, 1800),
        )
    return count


def record_failed_login(request, email: str = '') -> None:
    ip = get_client_ip(request)
    logger.warning('Failed login ip=%s', ip)
    threshold = int(getattr(settings, 'SECURITY_FAILED_LOGIN_THRESHOLD', 8))
    window = int(getattr(settings, 'SECURITY_FAILED_LOGIN_WINDOW', 600))
    maybe_threshold_alert(
        kind='failed-login',
        ident=ip,
        threshold=threshold,
        window=window,
        subject='Luminexa security: repeated failed logins',
        body=(
            f'Repeated failed sign-in attempts from IP {ip}.\n'
            'No password or email is included in this alert.'
        ),
    )


def record_auth_burst(request, *, kind: str) -> None:
    ip = get_client_ip(request)
    threshold = int(getattr(settings, 'SECURITY_AUTH_BURST_THRESHOLD', 12))
    window = int(getattr(settings, 'SECURITY_AUTH_BURST_WINDOW', 300))
    maybe_threshold_alert(
        kind=kind,
        ident=ip,
        threshold=threshold,
        window=window,
        subject=f'Luminexa security: {kind} burst from one IP',
        body=f'Unusual {kind} volume from IP {ip}.',
    )


def record_signup(request) -> None:
    ip = get_client_ip(request)
    logger.info('Signup ip=%s', ip)
    threshold = int(getattr(settings, 'SECURITY_SIGNUP_BURST_THRESHOLD', 4))
    window = int(getattr(settings, 'SECURITY_SIGNUP_BURST_WINDOW', 1800))
    maybe_threshold_alert(
        kind='signup-burst',
        ident=ip,
        threshold=threshold,
        window=window,
        subject='Luminexa security: signup burst from one IP',
        body=f'Multiple new accounts were created from IP {ip} in a short window.',
    )


def record_rate_limit_hit(request, scope: str = '') -> None:
    ip = get_client_ip(request)
    path = getattr(request, 'path', '') or ''
    logger.warning('Rate limit hit scope=%s ip=%s path=%s', scope, ip, path)
    threshold = int(getattr(settings, 'SECURITY_RATELIMIT_ALERT_THRESHOLD', 3))
    window = int(getattr(settings, 'SECURITY_RATELIMIT_ALERT_WINDOW', 600))
    maybe_threshold_alert(
        kind='rate-limit',
        ident=ip,
        threshold=threshold,
        window=window,
        subject='Luminexa security: rate-limit hits',
        body=f'Auth/API rate limits are being hit from IP {ip} (scope={scope or "unknown"}).',
    )


def record_probe(request, reason: str) -> None:
    ip = get_client_ip(request)
    path = (getattr(request, 'path', '') or '')[:200]
    logger.warning('Suspicious request ip=%s reason=%s path=%s', ip, reason, path)
    threshold = int(getattr(settings, 'SECURITY_PROBE_THRESHOLD', 3))
    window = int(getattr(settings, 'SECURITY_PROBE_WINDOW', 600))
    maybe_threshold_alert(
        kind='probe',
        ident=ip,
        threshold=threshold,
        window=window,
        subject='Luminexa security: suspicious request patterns',
        body=(
            f'Suspicious requests (e.g. SQL injection or path traversal probes) from IP {ip}.\n'
            f'Latest path (truncated): {path}\n'
            f'Reason: {reason}'
        ),
    )


def record_server_error(request, status: int) -> None:
    ip = get_client_ip(request)
    path = (getattr(request, 'path', '') or '')[:200]
    logger.error('HTTP %s ip=%s path=%s', status, ip, path)
    threshold = int(getattr(settings, 'SECURITY_5XX_SPIKE_THRESHOLD', 8))
    window = int(getattr(settings, 'SECURITY_5XX_SPIKE_WINDOW', 300))
    maybe_threshold_alert(
        kind='5xx-spike',
        ident='global',
        threshold=threshold,
        window=window,
        subject='Luminexa security: unexpected 5xx spike',
        body=(
            f'The app is returning server errors (latest HTTP {status}).\n'
            f'Latest path (truncated): {path}\n'
            f'Latest IP: {ip}'
        ),
        throttle_seconds=1800,
    )
