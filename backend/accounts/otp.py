"""Customer email OTP helpers."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from businesses.models import OrganizationMembership

from .models import LoginCode, User

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


def normalize_email(email: str) -> str:
    return (email or '').strip().lower()


def play_store_demo_emails() -> set[str]:
    """Emails that Play Console review accounts may use (password, never OTP)."""
    emails = {
        (getattr(settings, 'PLAY_STORE_DEMO_CUSTOMER_EMAIL', '') or '').strip().lower(),
        (getattr(settings, 'PLAY_STORE_DEMO_PROVIDER_EMAIL', '') or '').strip().lower(),
    }
    return {email for email in emails if email}


def is_play_store_demo_user(user: User | None) -> bool:
    if not user:
        return False
    return normalize_email(user.email) in play_store_demo_emails()


def play_store_demo_otp(email: str) -> str | None:
    """Legacy fixed OTP — unused when demo emails use password login."""
    demo_email = (getattr(settings, 'PLAY_STORE_DEMO_CUSTOMER_EMAIL', '') or '').strip().lower()
    demo_otp = (getattr(settings, 'PLAY_STORE_DEMO_CUSTOMER_OTP', '') or '').strip()
    if not demo_email or not demo_otp:
        return None
    if normalize_email(email) != demo_email:
        return None
    return demo_otp


def user_uses_password_login(user: User) -> bool:
    """Providers, Django staff, and Play Store demo accounts use email + password."""
    if not user:
        return False
    if is_play_store_demo_user(user):
        return True
    if user.is_staff or user.is_superuser:
        return True
    return OrganizationMembership.objects.filter(
        user=user,
        role__in=(
            OrganizationMembership.Role.OWNER,
            OrganizationMembership.Role.STAFF,
        ),
    ).exists()


def _generate_code() -> str:
    import secrets

    return f'{secrets.randbelow(1_000_000):06d}'


def issue_login_code(email: str) -> str:
    email = normalize_email(email)
    raw = play_store_demo_otp(email) or _generate_code()
    now = timezone.now()
    LoginCode.objects.filter(email=email, consumed_at__isnull=True).update(consumed_at=now)
    LoginCode.objects.create(
        email=email,
        code_hash=make_password(raw),
        expires_at=now + timedelta(minutes=OTP_TTL_MINUTES),
    )
    return raw


def verify_login_code(email: str, code: str) -> bool:
    email = normalize_email(email)
    code = (code or '').strip()
    if not email or not code:
        return False
    now = timezone.now()
    fixed = play_store_demo_otp(email)
    if fixed and code == fixed:
        # Accept fixed Play Store code without requiring inbox access.
        LoginCode.objects.filter(email=email, consumed_at__isnull=True).update(consumed_at=now)
        return True
    entry = (
        LoginCode.objects.filter(email=email, consumed_at__isnull=True, expires_at__gte=now)
        .order_by('-created_at')
        .first()
    )
    if not entry:
        return False
    if entry.attempt_count >= OTP_MAX_ATTEMPTS:
        return False
    entry.attempt_count += 1
    if not check_password(code, entry.code_hash):
        entry.save(update_fields=['attempt_count'])
        return False
    entry.consumed_at = now
    entry.save(update_fields=['attempt_count', 'consumed_at'])
    return True
