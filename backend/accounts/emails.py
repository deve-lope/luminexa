"""Outbound account emails (verification + password reset)."""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .tokens import email_verification_token

logger = logging.getLogger(__name__)


def _app_url(path: str) -> str:
    base = getattr(settings, 'PUBLIC_APP_URL', 'http://localhost:3000').rstrip('/')
    return f'{base}{path}'


def send_email_verification(user) -> bool:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)
    verify_url = _app_url(f'/verify-email?uid={uid}&token={token}')
    try:
        send_mail(
            subject='Verify your Luminexa email',
            message=(
                f'Hi {user.full_name or "there"},\n\n'
                'Thanks for creating a Luminexa account. '
                'Confirm your email address with this link:\n\n'
                f'{verify_url}\n\n'
                'If you did not sign up, you can ignore this email.\n'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception('Failed to send verification email to %s', user.email)
        return False


def send_password_reset_email(user, reset_url: str) -> bool:
    try:
        send_mail(
            subject='Reset your Luminexa password',
            message=(
                f'Hi {user.full_name or "there"},\n\n'
                'Use the link below to choose a new password. '
                'If you did not request this, you can ignore this email.\n\n'
                f'{reset_url}\n'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception('Failed to send password reset email to %s', user.email)
        return False
