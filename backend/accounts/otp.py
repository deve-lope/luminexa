"""Customer email OTP helpers."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from businesses.models import OrganizationMembership

from .models import LoginCode, User

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


def normalize_email(email: str) -> str:
    return (email or '').strip().lower()


def user_uses_password_login(user: User) -> bool:
    """Providers (and Django staff) keep email + password; customers use OTP."""
    if not user:
        return False
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
    raw = _generate_code()
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
