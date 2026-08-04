"""Django admin / staff 2FA helpers (Google Authenticator TOTP)."""

from __future__ import annotations


def user_is_admin_account(user) -> bool:
    return bool(user and (user.is_staff or user.is_superuser))


def verify_admin_totp(user, otp: str) -> bool:
    """Return True if otp matches a confirmed TOTP or backup token for user."""
    from django_otp import match_token

    code = (otp or '').strip().replace(' ', '')
    if not user or not code:
        return False
    return match_token(user, code) is not None
