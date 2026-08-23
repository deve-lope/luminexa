"""FCM outside-app push for Capacitor (Android / iOS).

Requires FIREBASE_CREDENTIALS_FILE (path to service-account JSON) or
FIREBASE_CREDENTIALS_JSON (raw JSON). When unset, sends are no-ops.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

_firebase_app = None
_missing_credentials_warned = False


def fcm_enabled() -> bool:
    path = (getattr(settings, 'FIREBASE_CREDENTIALS_FILE', '') or '').strip()
    raw = (getattr(settings, 'FIREBASE_CREDENTIALS_JSON', '') or '').strip()
    return bool(path or raw)


def _ensure_firebase():
    global _firebase_app, _missing_credentials_warned
    if _firebase_app is not None:
        return _firebase_app
    if not fcm_enabled():
        # Sends happen inline on many requests, so warn on the first drop only.
        if not _missing_credentials_warned:
            _missing_credentials_warned = True
            logger.warning(
                'FCM credentials not configured (set FIREBASE_CREDENTIALS_FILE or '
                'FIREBASE_CREDENTIALS_JSON); push notifications are being dropped'
            )
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        logger.warning('firebase-admin not installed; push disabled')
        return None

    if firebase_admin._apps:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app

    path = (getattr(settings, 'FIREBASE_CREDENTIALS_FILE', '') or '').strip()
    raw = (getattr(settings, 'FIREBASE_CREDENTIALS_JSON', '') or '').strip()
    try:
        if path:
            cred = credentials.Certificate(str(Path(path).expanduser()))
        else:
            cred = credentials.Certificate(json.loads(raw))
        _firebase_app = firebase_admin.initialize_app(cred)
        return _firebase_app
    except Exception:
        logger.exception('Failed to initialize Firebase for FCM')
        return None


def send_push_to_user(user, *, title: str, body: str, link_path: str = '') -> int:
    """Send data+notification push to all registered devices for a user. Returns send count."""
    if not user:
        return 0
    from accounts.models import DevicePushToken

    tokens = list(
        DevicePushToken.objects.filter(user_id=getattr(user, 'pk', user)).values_list(
            'token', flat=True
        )
    )
    if not tokens:
        return 0
    return _send_to_tokens(tokens, title=title, body=body, link_path=link_path or '')


def send_push_to_org_staff(organization, *, title: str, body: str, link_path: str = '') -> int:
    from businesses.models import OrganizationMembership

    user_ids = list(
        OrganizationMembership.objects.filter(
            organization=organization,
            role__in=(
                OrganizationMembership.Role.OWNER,
                OrganizationMembership.Role.STAFF,
            ),
        ).values_list('user_id', flat=True)
    )
    if not user_ids:
        return 0
    from accounts.models import DevicePushToken

    tokens = list(
        DevicePushToken.objects.filter(user_id__in=user_ids).values_list('token', flat=True)
    )
    if not tokens:
        return 0
    return _send_to_tokens(tokens, title=title, body=body, link_path=link_path or '')


def _send_to_tokens(tokens, *, title: str, body: str, link_path: str) -> int:
    if not _ensure_firebase():
        return 0
    try:
        from firebase_admin import messaging
    except ImportError:
        return 0

    data = {'link_path': link_path or '/'}
    sent = 0
    stale = []
    for token in tokens:
        try:
            messaging.send(
                messaging.Message(
                    token=token,
                    notification=messaging.Notification(
                        title=(title or 'Luminexa')[:120],
                        body=(body or '')[:240],
                    ),
                    data={k: str(v) for k, v in data.items()},
                    # No click_action: @capacitor/push-notifications reads the tap
                    # off the default launcher intent to fire
                    # pushNotificationActionPerformed.
                    android=messaging.AndroidConfig(priority='high'),
                    # iOS stays silent unless the APNs payload names a sound.
                    apns=messaging.APNSConfig(
                        headers={'apns-priority': '10'},
                        payload=messaging.APNSPayload(
                            aps=messaging.Aps(sound='default'),
                        ),
                    ),
                )
            )
            sent += 1
        except Exception as exc:
            code = getattr(exc, 'code', '') or ''
            msg = str(exc).lower()
            if (
                'not-found' in msg
                or 'unregistered' in msg
                or 'invalid-argument' in msg
                or code in ('NOT_FOUND', 'UNREGISTERED', 'INVALID_ARGUMENT')
            ):
                stale.append(token)
            else:
                logger.warning('FCM send failed for token …%s: %s', token[-8:], exc)
    if stale:
        from accounts.models import DevicePushToken

        DevicePushToken.objects.filter(token__in=stale).delete()
    return sent
