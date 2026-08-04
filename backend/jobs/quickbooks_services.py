"""QuickBooks Online OAuth + one-way push (customers, invoices, payments)."""

from __future__ import annotations

import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from businesses.models import Organization, OrganizationMembership

logger = logging.getLogger(__name__)

INTUIT_AUTH = 'https://appcenter.intuit.com/connect/oauth2'
INTUIT_TOKEN = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
SANDBOX_API = 'https://sandbox-quickbooks.api.intuit.com'
PROD_API = 'https://quickbooks.api.intuit.com'


def qbo_configured() -> bool:
    return bool(
        getattr(settings, 'QUICKBOOKS_CLIENT_ID', '')
        and getattr(settings, 'QUICKBOOKS_CLIENT_SECRET', '')
    )


def qbo_enabled() -> bool:
    return bool(getattr(settings, 'QUICKBOOKS_ENABLED', False) and qbo_configured())


def _api_base() -> str:
    env = (getattr(settings, 'QUICKBOOKS_ENVIRONMENT', 'sandbox') or 'sandbox').lower()
    return PROD_API if env == 'production' else SANDBOX_API


def _redirect_uri() -> str:
    explicit = (getattr(settings, 'QUICKBOOKS_REDIRECT_URI', '') or '').strip()
    if explicit:
        return explicit
    base = (getattr(settings, 'PUBLIC_APP_URL', None) or 'http://localhost:3000').rstrip('/')
    # SPA catches /settings?qbo=…; API callback is under /api/v1/
    api_public = (getattr(settings, 'PUBLIC_API_URL', None) or '').rstrip('/')
    if api_public:
        return f'{api_public}/api/v1/accounting/quickbooks/callback/'
    # Same-origin nginx: browser hits frontend host which proxies /api
    return f'{base}/api/v1/accounting/quickbooks/callback/'


def qbo_status(org: Organization) -> dict:
    return {
        'configured': qbo_configured(),
        'enabled': qbo_enabled(),
        'connected': bool(org.qbo_realm_id and org.qbo_refresh_token),
        'realm_id': org.qbo_realm_id or None,
        'connected_at': org.qbo_connected_at,
        'environment': getattr(settings, 'QUICKBOOKS_ENVIRONMENT', 'sandbox') or 'sandbox',
    }


def require_qbo():
    if not qbo_enabled():
        raise ValidationError({
            'detail': (
                'QuickBooks is not configured. Set QUICKBOOKS_CLIENT_ID and '
                'QUICKBOOKS_CLIENT_SECRET on the server.'
            ),
            'code': 'quickbooks_not_configured',
        })


def build_connect_url(*, org: Organization, state: str) -> str:
    require_qbo()
    params = {
        'client_id': settings.QUICKBOOKS_CLIENT_ID,
        'redirect_uri': _redirect_uri(),
        'response_type': 'code',
        'scope': 'com.intuit.quickbooks.accounting',
        'state': state,
    }
    return f'{INTUIT_AUTH}?{urllib.parse.urlencode(params)}'


def _basic_auth_header() -> str:
    raw = f'{settings.QUICKBOOKS_CLIENT_ID}:{settings.QUICKBOOKS_CLIENT_SECRET}'
    return 'Basic ' + base64.b64encode(raw.encode()).decode()


def _token_request(body: dict) -> dict:
    data = urllib.parse.urlencode(body).encode()
    req = urllib.request.Request(
        INTUIT_TOKEN,
        data=data,
        headers={
            'Authorization': _basic_auth_header(),
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode() if exc.fp else str(exc)
        logger.warning('QBO token error: %s', detail)
        raise ValidationError({
            'detail': 'QuickBooks authorization failed. Disconnect and reconnect.',
            'code': 'quickbooks_token_error',
        }) from exc


def exchange_code_for_tokens(*, org: Organization, code: str, realm_id: str) -> Organization:
    require_qbo()
    payload = _token_request({
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': _redirect_uri(),
    })
    return _apply_tokens(org, payload, realm_id=realm_id)


def refresh_tokens(org: Organization) -> Organization:
    if not org.qbo_refresh_token:
        raise ValidationError({'detail': 'QuickBooks is not connected.', 'code': 'qbo_not_connected'})
    payload = _token_request({
        'grant_type': 'refresh_token',
        'refresh_token': org.qbo_refresh_token,
    })
    return _apply_tokens(org, payload, realm_id=org.qbo_realm_id)


def _apply_tokens(org: Organization, payload: dict, *, realm_id: str) -> Organization:
    expires_in = int(payload.get('expires_in') or 3600)
    org.qbo_access_token = payload.get('access_token') or ''
    org.qbo_refresh_token = payload.get('refresh_token') or org.qbo_refresh_token
    org.qbo_realm_id = realm_id or org.qbo_realm_id
    org.qbo_token_expires_at = timezone.now() + timedelta(seconds=max(60, expires_in - 60))
    if not org.qbo_connected_at:
        org.qbo_connected_at = timezone.now()
    org.save(update_fields=[
        'qbo_access_token',
        'qbo_refresh_token',
        'qbo_realm_id',
        'qbo_token_expires_at',
        'qbo_connected_at',
        'updated_at',
    ])
    return org


def disconnect_qbo(org: Organization) -> Organization:
    org.qbo_realm_id = ''
    org.qbo_access_token = ''
    org.qbo_refresh_token = ''
    org.qbo_token_expires_at = None
    org.qbo_connected_at = None
    org.save(update_fields=[
        'qbo_realm_id',
        'qbo_access_token',
        'qbo_refresh_token',
        'qbo_token_expires_at',
        'qbo_connected_at',
        'updated_at',
    ])
    return org


def _ensure_access_token(org: Organization) -> Organization:
    if not org.qbo_realm_id or not org.qbo_refresh_token:
        raise ValidationError({'detail': 'QuickBooks is not connected.', 'code': 'qbo_not_connected'})
    if org.qbo_token_expires_at and org.qbo_token_expires_at > timezone.now() and org.qbo_access_token:
        return org
    return refresh_tokens(org)


def _qbo_request(org: Organization, method: str, path: str, body: dict | None = None) -> dict:
    org = _ensure_access_token(org)
    url = f'{_api_base()}/v3/company/{org.qbo_realm_id}/{path.lstrip("/")}'
    if '?' not in url:
        url = f'{url}?minorversion=65'
    data = None
    headers = {
        'Authorization': f'Bearer {org.qbo_access_token}',
        'Accept': 'application/json',
    }
    if body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode() if exc.fp else str(exc)
        logger.warning('QBO API %s %s failed: %s', method, path, detail[:500])
        raise ValidationError({
            'detail': f'QuickBooks API error ({exc.code}). Check connection and try again.',
            'code': 'quickbooks_api_error',
        }) from exc


def _ensure_qbo_customer(org: Organization, customer_user) -> str:
    membership = OrganizationMembership.objects.filter(
        organization=org,
        user=customer_user,
        role=OrganizationMembership.Role.CUSTOMER,
    ).first()
    if membership and membership.qbo_customer_id:
        return membership.qbo_customer_id

    display = (customer_user.full_name or customer_user.email or 'Customer').strip()
    payload = {
        'DisplayName': f'{display} (LX{customer_user.id})'[:500],
        'PrimaryEmailAddr': {'Address': customer_user.email} if customer_user.email else None,
        'PrimaryPhone': {'FreeFormNumber': customer_user.phone} if customer_user.phone else None,
        'Notes': f'Luminexa customer id {customer_user.id}',
    }
    # Drop nulls
    payload = {k: v for k, v in payload.items() if v is not None}
    result = _qbo_request(org, 'POST', 'customer', payload)
    qbo_id = str((result.get('Customer') or {}).get('Id') or '')
    if not qbo_id:
        raise ValidationError({'detail': 'QuickBooks did not return a customer id.'})
    if membership:
        membership.qbo_customer_id = qbo_id
        membership.save(update_fields=['qbo_customer_id'])
    return qbo_id


def sync_invoice_to_qbo(invoice) -> dict:
    """Create/update QBO Invoice (+ Payment if paid). Best-effort; logs failures."""
    from .models import Invoice

    org = invoice.booking.organization
    if not qbo_enabled() or not org.qbo_realm_id:
        return {'skipped': True, 'reason': 'not_connected'}

    try:
        customer_id = _ensure_qbo_customer(org, invoice.booking.customer)
        service_name = (
            invoice.booking.service.name
            if invoice.booking.service_id
            else (invoice.description or 'Service')
        )
        amount = Decimal(str(invoice.amount or '0'))
        line = {
            'Amount': float(amount),
            'DetailType': 'SalesItemLineDetail',
            'Description': f'{invoice.number} — {service_name}',
            'SalesItemLineDetail': {
                'Qty': 1,
                'UnitPrice': float(amount),
            },
        }
        if not invoice.qbo_invoice_id:
            body = {
                'DocNumber': invoice.number[:21],
                'CustomerRef': {'value': customer_id},
                'PrivateNote': f'Luminexa booking {invoice.booking_id}',
                'Line': [line],
            }
            created = _qbo_request(org, 'POST', 'invoice', body)
            invoice.qbo_invoice_id = str((created.get('Invoice') or {}).get('Id') or '')
        # Payment when paid
        if invoice.status == Invoice.Status.PAID and invoice.qbo_invoice_id and not invoice.qbo_payment_id:
            pay_body = {
                'CustomerRef': {'value': customer_id},
                'TotalAmt': float(amount),
                'PrivateNote': f'Luminexa invoice {invoice.number}',
                'Line': [{
                    'Amount': float(amount),
                    'LinkedTxn': [{
                        'TxnId': invoice.qbo_invoice_id,
                        'TxnType': 'Invoice',
                    }],
                }],
            }
            paid = _qbo_request(org, 'POST', 'payment', pay_body)
            invoice.qbo_payment_id = str((paid.get('Payment') or {}).get('Id') or '')
        invoice.qbo_synced_at = timezone.now()
        invoice.save(update_fields=[
            'qbo_invoice_id', 'qbo_payment_id', 'qbo_synced_at', 'updated_at',
        ])
        return {
            'invoice_id': invoice.qbo_invoice_id,
            'payment_id': invoice.qbo_payment_id or None,
        }
    except Exception:
        logger.exception('QBO sync failed for invoice %s', invoice.pk)
        raise


def sync_org_recent_invoices(org: Organization, *, limit: int = 50) -> dict:
    from .models import Invoice

    require_qbo()
    if not org.qbo_realm_id:
        raise ValidationError({'detail': 'Connect QuickBooks first.', 'code': 'qbo_not_connected'})

    qs = (
        Invoice.objects.filter(booking__organization=org)
        .exclude(status=Invoice.Status.VOID)
        .select_related('booking', 'booking__customer', 'booking__service')
        .order_by('-issued_at')[:limit]
    )
    synced = 0
    errors = 0
    for inv in qs:
        try:
            sync_invoice_to_qbo(inv)
            synced += 1
        except Exception:
            errors += 1
    return {'synced': synced, 'errors': errors, 'total': qs.count()}
