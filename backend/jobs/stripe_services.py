"""Stripe Connect (job payments) + Billing (provider subscriptions)."""

from __future__ import annotations

from datetime import timezone as dt_timezone
from decimal import Decimal, ROUND_HALF_UP

import stripe
from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from businesses.models import Organization


def platform_fee_percent() -> Decimal:
    """Luminexa’s share of each invoice card payment (not Stripe’s processing fee)."""
    raw = getattr(settings, 'STRIPE_PLATFORM_FEE_PERCENT', 0.5)
    try:
        value = Decimal(str(raw if raw is not None else 0.5))
    except Exception:
        value = Decimal('0.5')
    if value < 0:
        return Decimal('0')
    return value


def platform_fee_cents_for_amount(amount_cents: int) -> int:
    """0.5% (configurable) of the charge, rounded to cents; always < amount."""
    if amount_cents <= 0:
        return 0
    fee = int(
        (Decimal(amount_cents) * platform_fee_percent() / Decimal('100')).quantize(
            Decimal('1'),
            rounding=ROUND_HALF_UP,
        )
    )
    if fee >= amount_cents:
        return max(0, amount_cents - 1)
    return fee


def stripe_configured() -> bool:
    return bool(getattr(settings, 'STRIPE_SECRET_KEY', '') or '')


def require_stripe():
    if not stripe_configured():
        raise ValidationError({
            'detail': 'Online payments are not configured yet. Add STRIPE_SECRET_KEY to the server env.',
            'code': 'stripe_not_configured',
        })
    stripe.api_key = settings.STRIPE_SECRET_KEY


def _raise_stripe_error(exc: Exception) -> None:
    """Turn Stripe API errors into readable API validation errors (not HTML 500s)."""
    msg = getattr(exc, 'user_message', None) or getattr(exc, 'message', None) or str(exc)
    msg = str(msg).strip() or 'Stripe request failed.'
    lower = msg.lower()
    if 'signed up for connect' in lower or 'connect' in lower and 'dashboard.stripe.com/connect' in lower:
        raise ValidationError({
            'detail': (
                'Stripe Connect is not enabled on this Stripe account yet. '
                'Open https://dashboard.stripe.com/test/connect (Test mode) or '
                'https://dashboard.stripe.com/connect (Live), complete Connect setup, then try again.'
            ),
            'code': 'stripe_connect_not_enabled',
        }) from exc
    if 'managing losses' in lower or 'platform-profile' in lower:
        raise ValidationError({
            'detail': (
                'Finish your Stripe Connect platform profile first: open '
                'https://dashboard.stripe.com/settings/connect/platform-profile '
                '(Live mode), review how you manage losses for connected accounts, save, '
                'then try Set up payouts again.'
            ),
            'code': 'stripe_connect_platform_profile',
        }) from exc
    raise ValidationError({'detail': msg, 'code': 'stripe_error'}) from exc


def _app_url(path: str) -> str:
    base = (getattr(settings, 'PUBLIC_APP_URL', None) or 'http://localhost:3000').rstrip('/')
    if not path.startswith('/'):
        path = f'/{path}'
    return f'{base}{path}'


def _app_url_with_query(path: str, query: str) -> str:
    separator = '&' if '?' in path else '?'
    return f'{_app_url(path)}{separator}{query}'


def amount_to_cents(amount) -> int:
    value = Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    if value <= 0:
        raise ValidationError({'amount': 'Payment amount must be greater than zero.'})
    return int(value * 100)


def ensure_connect_account(org: Organization, *, owner_email: str) -> Organization:
    require_stripe()
    if org.stripe_account_id:
        return refresh_connect_account(org)

    try:
        account = stripe.Account.create(
            type='express',
            email=owner_email or None,
            capabilities={
                'card_payments': {'requested': True},
                'transfers': {'requested': True},
            },
            business_profile={
                'name': org.name,
                'url': _app_url(f'/book/{org.slug}'),
            },
            metadata={'organization_id': str(org.id), 'organization_slug': org.slug},
        )
    except stripe.error.StripeError as exc:
        _raise_stripe_error(exc)
    org.stripe_account_id = account.id
    org.save(update_fields=['stripe_account_id', 'updated_at'])
    return refresh_connect_account(org)


def refresh_connect_account(org: Organization) -> Organization:
    require_stripe()
    if not org.stripe_account_id:
        return org
    try:
        account = stripe.Account.retrieve(org.stripe_account_id)
    except stripe.error.StripeError as exc:
        _raise_stripe_error(exc)
    org.stripe_charges_enabled = bool(account.get('charges_enabled'))
    org.stripe_payouts_enabled = bool(account.get('payouts_enabled'))
    org.stripe_details_submitted = bool(account.get('details_submitted'))
    org.save(update_fields=[
        'stripe_charges_enabled',
        'stripe_payouts_enabled',
        'stripe_details_submitted',
        'updated_at',
    ])
    return org


def create_connect_onboarding_link(org: Organization, *, owner_email: str, return_path: str) -> str:
    org = ensure_connect_account(org, owner_email=owner_email)
    try:
        link = stripe.AccountLink.create(
            account=org.stripe_account_id,
            refresh_url=_app_url(return_path),
            return_url=_app_url(return_path),
            type='account_onboarding',
        )
    except stripe.error.StripeError as exc:
        _raise_stripe_error(exc)
    return link.url


def create_connect_login_link(org: Organization) -> str:
    require_stripe()
    if not org.stripe_account_id:
        raise ValidationError({'detail': 'Connect payouts first.'})
    try:
        link = stripe.Account.create_login_link(org.stripe_account_id)
    except stripe.error.StripeError as exc:
        _raise_stripe_error(exc)
    return link.url


def org_can_accept_card_payments(org: Organization) -> bool:
    return bool(org.stripe_account_id and org.stripe_charges_enabled)


_apple_pay_domains_ensured = False


def ensure_apple_pay_domains() -> None:
    """Register SPA hostnames so Apple Pay can show in Safari / iOS (idempotent)."""
    global _apple_pay_domains_ensured
    if _apple_pay_domains_ensured:
        return
    require_stripe()
    base = (getattr(settings, 'PUBLIC_APP_URL', None) or '').strip()
    hosts = set()
    if base:
        try:
            from urllib.parse import urlparse

            host = (urlparse(base).hostname or '').lower()
            if host:
                hosts.add(host)
                # Common apex / www pair.
                if host.startswith('www.'):
                    hosts.add(host[4:])
                elif host.count('.') == 1:
                    hosts.add(f'www.{host}')
                # app.example.com → also register example.com
                parts = host.split('.')
                if len(parts) >= 3 and parts[0] in ('app', 'www', 'm'):
                    hosts.add('.'.join(parts[1:]))
        except Exception:
            pass
    hosts.update({'luminex-a.com', 'www.luminex-a.com', 'app.luminex-a.com'})
    for domain in sorted(hosts):
        if not domain or domain in ('localhost', '127.0.0.1'):
            continue
        try:
            stripe.ApplePayDomain.create(domain_name=domain)
        except stripe.error.StripeError:
            # Already registered or not allowed in this account mode — ignore.
            pass
    _apple_pay_domains_ensured = True

def create_invoice_checkout_session(
    *,
    invoice,
    customer_user,
    success_path: str,
    cancel_path: str,
) -> dict:
    """Legacy hosted Checkout (kept for fallback). Prefer create_invoice_payment_intent."""
    require_stripe()
    from jobs.models import Invoice

    if invoice.status == Invoice.Status.PAID:
        raise ValidationError({'detail': 'This invoice is already paid.'})
    if invoice.status == Invoice.Status.VOID:
        raise ValidationError({'detail': 'This invoice is void.'})

    org = invoice.booking.organization
    org = refresh_connect_account(org)
    if not org_can_accept_card_payments(org):
        raise ValidationError({
            'detail': 'This business has not finished setting up card payments yet.',
            'code': 'connect_incomplete',
        })

    if invoice.booking.customer_id != customer_user.id:
        raise PermissionDenied('Only the customer can pay this invoice.')

    amount_cents = amount_to_cents(invoice.amount)
    fee = platform_fee_cents_for_amount(amount_cents)

    currency = (invoice.currency or 'CAD').lower()
    payment_intent_data = {
        'transfer_data': {'destination': org.stripe_account_id},
        'metadata': {
            'invoice_id': str(invoice.id),
            'booking_id': str(invoice.booking_id),
            'organization_id': str(org.id),
        },
    }
    # Luminexa platform fee (percent of charge). Stripe’s card fee is separate.
    if fee > 0:
        payment_intent_data['application_fee_amount'] = fee

    try:
        session = stripe.checkout.Session.create(
            mode='payment',
            # Apple Pay and Google Pay are card wallets and appear automatically
            # on Stripe-hosted Checkout when available on the customer's device.
            payment_method_types=['card'],
            customer_email=customer_user.email or None,
            line_items=[{
                'price_data': {
                    'currency': currency,
                    'unit_amount': amount_cents,
                    'product_data': {
                        'name': f'Invoice {invoice.number}',
                        'description': (
                            invoice.description
                            or (
                                invoice.booking.service.name
                                if invoice.booking.service_id
                                else 'Service'
                            )
                        ),
                    },
                },
                'quantity': 1,
            }],
            payment_intent_data=payment_intent_data,
            success_url=_app_url_with_query(
                success_path,
                'paid=1&session_id={CHECKOUT_SESSION_ID}',
            ),
            cancel_url=_app_url_with_query(cancel_path, 'paid=0'),
            metadata={
                'kind': 'invoice_payment',
                'invoice_id': str(invoice.id),
                'booking_id': str(invoice.booking_id),
                'organization_id': str(org.id),
            },
        )
    except stripe.error.StripeError as exc:
        _raise_stripe_error(exc)
    invoice.stripe_checkout_session_id = session.id
    invoice.platform_fee_cents = fee
    invoice.save(update_fields=['stripe_checkout_session_id', 'platform_fee_cents', 'updated_at'])
    return {'checkout_url': session.url, 'session_id': session.id}


def create_invoice_payment_intent(*, invoice, customer_user) -> dict:
    """In-app Payment Element: PaymentIntent with Connect destination + platform fee."""
    require_stripe()
    from jobs.models import Invoice

    if invoice.status == Invoice.Status.PAID:
        raise ValidationError({'detail': 'This invoice is already paid.'})
    if invoice.status == Invoice.Status.VOID:
        raise ValidationError({'detail': 'This invoice is void.'})

    org = invoice.booking.organization
    org = refresh_connect_account(org)
    if not org_can_accept_card_payments(org):
        raise ValidationError({
            'detail': 'This business has not finished setting up card payments yet.',
            'code': 'connect_incomplete',
        })

    if invoice.booking.customer_id != customer_user.id:
        raise PermissionDenied('Only the customer can pay this invoice.')

    amount_cents = amount_to_cents(invoice.amount)
    fee = platform_fee_cents_for_amount(amount_cents)
    currency = (invoice.currency or 'CAD').lower()
    publishable = getattr(settings, 'STRIPE_PUBLISHABLE_KEY', '') or ''
    if not publishable:
        raise ValidationError({
            'detail': 'Online payments need STRIPE_PUBLISHABLE_KEY on the server.',
            'code': 'stripe_publishable_missing',
        })

    metadata = {
        'kind': 'invoice_payment',
        'invoice_id': str(invoice.id),
        'booking_id': str(invoice.booking_id),
        'organization_id': str(org.id),
    }

    # Reuse an open intent when the customer reopens Pay (avoids duplicate PIs).
    if invoice.stripe_payment_intent_id:
        try:
            existing = stripe.PaymentIntent.retrieve(invoice.stripe_payment_intent_id)
        except stripe.error.StripeError:
            existing = None
        if existing is not None:
            status = existing.get('status') if isinstance(existing, dict) else existing.status
            amount = existing.get('amount') if isinstance(existing, dict) else existing.amount
            cur = existing.get('currency') if isinstance(existing, dict) else existing.currency
            client_secret = (
                existing.get('client_secret')
                if isinstance(existing, dict)
                else existing.client_secret
            )
            pi_id = existing.get('id') if isinstance(existing, dict) else existing.id
            if (
                status in (
                    'requires_payment_method',
                    'requires_confirmation',
                    'requires_action',
                )
                and int(amount or 0) == amount_cents
                and str(cur or '') == currency
                and client_secret
            ):
                invoice.platform_fee_cents = fee
                invoice.save(update_fields=['platform_fee_cents', 'updated_at'])
                return {
                    'mode': 'payment_element',
                    'client_secret': client_secret,
                    'payment_intent_id': pi_id,
                    'publishable_key': publishable,
                    'amount_cents': amount_cents,
                    'currency': currency,
                }

    create_kwargs = {
        'amount': amount_cents,
        'currency': currency,
        # Card only — Apple Pay / Google Pay attach as card wallets.
        # Do not use automatic_payment_methods (that re-enables Link).
        'payment_method_types': ['card'],
        'transfer_data': {'destination': org.stripe_account_id},
        'metadata': metadata,
        'description': f'Invoice {invoice.number}',
        'receipt_email': customer_user.email or None,
    }
    if fee > 0:
        create_kwargs['application_fee_amount'] = fee

    try:
        ensure_apple_pay_domains()
        intent = stripe.PaymentIntent.create(**create_kwargs)
    except stripe.error.StripeError as exc:
        _raise_stripe_error(exc)

    pi_id = intent.get('id') if isinstance(intent, dict) else intent.id
    client_secret = (
        intent.get('client_secret') if isinstance(intent, dict) else intent.client_secret
    )
    invoice.stripe_payment_intent_id = pi_id
    invoice.platform_fee_cents = fee
    invoice.save(update_fields=['stripe_payment_intent_id', 'platform_fee_cents', 'updated_at'])
    return {
        'mode': 'payment_element',
        'client_secret': client_secret,
        'payment_intent_id': pi_id,
        'publishable_key': publishable,
        'amount_cents': amount_cents,
        'currency': currency,
    }


def sync_invoice_checkout_session(*, invoice, customer_user, session_id: str):
    """Confirm a returned Checkout Session without waiting for the webhook."""
    require_stripe()
    if invoice.booking.customer_id != customer_user.id:
        raise PermissionDenied('Only the customer can confirm this payment.')
    if not session_id:
        raise ValidationError({'session_id': 'Missing Checkout session id.'})
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as exc:
        _raise_stripe_error(exc)
    metadata = session.get('metadata') or {}
    if str(metadata.get('invoice_id') or '') != str(invoice.id):
        raise PermissionDenied('This checkout session does not belong to this invoice.')
    if session.get('mode') != 'payment':
        raise ValidationError({'session_id': 'Not an invoice payment session.'})
    if session.get('payment_status') != 'paid':
        raise ValidationError({'detail': 'Payment has not completed yet.'})
    payment_intent = session.get('payment_intent') or ''
    if isinstance(payment_intent, dict):
        payment_intent = payment_intent.get('id') or ''
    return mark_invoice_paid_from_stripe(
        invoice=invoice,
        payment_intent_id=str(payment_intent),
        session_id=session.get('id') or '',
    )


def sync_invoice_payment_intent(*, invoice, customer_user, payment_intent_id: str):
    """Confirm an in-app PaymentIntent after Elements confirmPayment."""
    require_stripe()
    if invoice.booking.customer_id != customer_user.id:
        raise PermissionDenied('Only the customer can confirm this payment.')
    if not payment_intent_id:
        raise ValidationError({'payment_intent_id': 'Missing payment intent id.'})
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
    except stripe.error.StripeError as exc:
        _raise_stripe_error(exc)
    metadata = intent.get('metadata') if isinstance(intent, dict) else (intent.metadata or {})
    if str(metadata.get('invoice_id') or '') != str(invoice.id):
        raise PermissionDenied('This payment does not belong to this invoice.')
    status = intent.get('status') if isinstance(intent, dict) else intent.status
    if status != 'succeeded':
        raise ValidationError({'detail': 'Payment has not completed yet.', 'code': 'payment_incomplete'})
    pi_id = intent.get('id') if isinstance(intent, dict) else intent.id
    return mark_invoice_paid_from_stripe(
        invoice=invoice,
        payment_intent_id=str(pi_id),
    )


def mark_invoice_paid_from_stripe(*, invoice, payment_intent_id='', session_id=''):
    from jobs.invoice_services import mark_invoice_paid
    from jobs.models import Invoice
    from jobs.notifications import notify_invoice_paid

    if invoice.status == Invoice.Status.PAID:
        notify_invoice_paid(invoice)
        return invoice
    mark_invoice_paid(invoice)
    invoice.refresh_from_db()
    updates = ['payment_method', 'updated_at']
    invoice.payment_method = 'stripe'
    if payment_intent_id:
        invoice.stripe_payment_intent_id = payment_intent_id
        updates.append('stripe_payment_intent_id')
    if session_id:
        invoice.stripe_checkout_session_id = session_id
        updates.append('stripe_checkout_session_id')
    if invoice.platform_fee_cents is None:
        invoice.platform_fee_cents = platform_fee_cents_for_amount(
            amount_to_cents(invoice.amount),
        )
        updates.append('platform_fee_cents')
    invoice.save(update_fields=updates)
    notify_invoice_paid(invoice)
    return invoice


def ensure_stripe_customer(org: Organization, *, owner_email: str, owner_name: str = '') -> Organization:
    require_stripe()
    if org.stripe_customer_id:
        return org
    customer = stripe.Customer.create(
        email=owner_email or None,
        name=owner_name or org.name,
        metadata={'organization_id': str(org.id), 'organization_slug': org.slug},
    )
    org.stripe_customer_id = customer.id
    org.save(update_fields=['stripe_customer_id', 'updated_at'])
    return org


def create_subscription_checkout(
    *,
    org: Organization,
    owner_email: str,
    owner_name: str,
    plan: str,
    success_path: str,
    cancel_path: str,
) -> dict:
    """Provider pays Luminexa for Pro subscription."""
    require_stripe()
    price_map = {
        'pro_monthly': getattr(settings, 'STRIPE_PRICE_PRO_MONTHLY', '') or '',
        'pro_yearly': getattr(settings, 'STRIPE_PRICE_PRO_YEARLY', '') or '',
    }
    price_id = price_map.get(plan)
    if not price_id:
        raise ValidationError({
            'plan': 'Subscription price is not configured. Set STRIPE_PRICE_PRO_MONTHLY / YEARLY.',
            'code': 'stripe_price_missing',
        })

    org = ensure_stripe_customer(org, owner_email=owner_email, owner_name=owner_name)
    subscription_data = {
        'metadata': {
            'organization_id': str(org.id),
            'plan': plan,
        },
    }
    trial_days = int(getattr(settings, 'STRIPE_TRIAL_DAYS', 0) or 0)
    if trial_days > 0:
        subscription_data['trial_period_days'] = trial_days
        # Allow starting the trial without collecting a card up front.
        subscription_data['trial_settings'] = {
            'end_behavior': {'missing_payment_method': 'cancel'},
        }

    session_kwargs = {
        'mode': 'subscription',
        'customer': org.stripe_customer_id,
        'line_items': [{'price': price_id, 'quantity': 1}],
        'success_url': _app_url(success_path) + '?sub=1&session_id={CHECKOUT_SESSION_ID}',
        'cancel_url': _app_url(cancel_path) + '?sub=0',
        'metadata': {
            'kind': 'provider_subscription',
            'organization_id': str(org.id),
            'plan': plan,
        },
        'subscription_data': subscription_data,
    }
    if trial_days > 0:
        session_kwargs['payment_method_collection'] = 'if_required'

    session = stripe.checkout.Session.create(**session_kwargs)
    return {'checkout_url': session.url, 'session_id': session.id}


def create_billing_portal_session(*, org: Organization, return_path: str) -> dict:
    require_stripe()
    if not org.stripe_customer_id:
        raise ValidationError({'detail': 'No billing account yet. Subscribe first.'})
    session = stripe.billing_portal.Session.create(
        customer=org.stripe_customer_id,
        return_url=_app_url(return_path),
    )
    return {'portal_url': session.url}


def apply_subscription_from_stripe(*, org: Organization, subscription) -> Organization:
    status = subscription.get('status') or 'none'
    now = timezone.now()
    promo_active = (
        (org.subscription_source or '') == 'promo'
        and org.subscription_current_period_end
        and org.subscription_current_period_end > now
        and (org.subscription_status or '') in ('active', 'trialing')
    )
    # Do not wipe an active complimentary promo when Stripe reports canceled/none.
    if promo_active and status not in ('active', 'trialing'):
        if subscription.get('id'):
            org.stripe_subscription_id = subscription.get('id')
            org.save(update_fields=['stripe_subscription_id', 'updated_at'])
        return org

    org.stripe_subscription_id = subscription.get('id') or org.stripe_subscription_id
    org.subscription_status = status
    plan = (subscription.get('metadata') or {}).get('plan') or org.subscription_plan or 'pro_monthly'
    if status in ('active', 'trialing'):
        org.subscription_plan = plan if plan.startswith('pro') else 'pro_monthly'
        org.subscription_source = 'stripe'
    elif status in ('canceled', 'unpaid', 'incomplete_expired'):
        if status == 'canceled':
            org.subscription_plan = 'free'
            org.subscription_source = 'none'
    period_end = subscription.get('current_period_end')
    if period_end:
        org.subscription_current_period_end = timezone.datetime.fromtimestamp(
            period_end, tz=dt_timezone.utc,
        )
    org.save(update_fields=[
        'stripe_subscription_id',
        'subscription_status',
        'subscription_plan',
        'subscription_source',
        'subscription_current_period_end',
        'updated_at',
    ])
    return org


def sync_subscription_checkout_session(*, org: Organization, session_id: str) -> Organization:
    """Pull subscription status from a completed Checkout Session (faster than waiting on webhook)."""
    require_stripe()
    if not session_id:
        raise ValidationError({'session_id': 'Missing Checkout session id.'})
    session = stripe.checkout.Session.retrieve(session_id, expand=['subscription'])
    meta = session.get('metadata') or {}
    if meta.get('organization_id') and str(meta.get('organization_id')) != str(org.id):
        raise PermissionDenied('This checkout session does not belong to this business.')
    if session.get('mode') != 'subscription':
        raise ValidationError({'session_id': 'Not a subscription checkout session.'})
    sub = session.get('subscription')
    if isinstance(sub, str):
        sub = stripe.Subscription.retrieve(sub)
    if not sub:
        raise ValidationError({'detail': 'Subscription not ready yet. Try again in a moment.'})
    plan = meta.get('plan') or 'pro_monthly'
    sub_dict = dict(sub) if not isinstance(sub, dict) else sub
    meta_sub = dict(sub_dict.get('metadata') or {})
    if not meta_sub.get('plan'):
        meta_sub['plan'] = plan
        sub_dict['metadata'] = meta_sub
    return apply_subscription_from_stripe(org=org, subscription=sub_dict)


def billing_summary(org: Organization) -> dict:
    connect = {
        'account_id': org.stripe_account_id or None,
        'charges_enabled': org.stripe_charges_enabled,
        'payouts_enabled': org.stripe_payouts_enabled,
        'details_submitted': org.stripe_details_submitted,
        'can_accept_cards': org_can_accept_card_payments(org),
    }
    payouts = {
        'instant_available_cents': 0,
        'available_cents': 0,
        'currency': 'cad',
        'instant_supported': False,
        'detail': '',
    }
    if org.stripe_account_id and stripe_configured():
        try:
            payouts = connect_payout_balance(org)
        except Exception:
            payouts['detail'] = 'Could not load Stripe balance.'

    from . import quickbooks_services
    from .permissions import org_has_active_subscription

    return {
        'stripe_configured': stripe_configured(),
        'publishable_key': getattr(settings, 'STRIPE_PUBLISHABLE_KEY', '') or '',
        'platform_fee_percent': float(platform_fee_percent()),
        'connect': connect,
        'payouts': payouts,
        'quickbooks': quickbooks_services.qbo_status(org),
        'subscription': {
            'status': org.subscription_status or 'none',
            'plan': org.subscription_plan or 'free',
            'source': getattr(org, 'subscription_source', None) or 'none',
            'current_period_end': org.subscription_current_period_end,
            'active': org_has_active_subscription(org),
            'has_customer': bool(org.stripe_customer_id),
            'trial_days': int(getattr(settings, 'STRIPE_TRIAL_DAYS', 0) or 0),
            'prices_configured': {
                'pro_monthly': bool(getattr(settings, 'STRIPE_PRICE_PRO_MONTHLY', '')),
                'pro_yearly': bool(getattr(settings, 'STRIPE_PRICE_PRO_YEARLY', '')),
            },
        },
    }


def connect_payout_balance(org: Organization) -> dict:
    """Available and Instant Payout balances for a Connect account."""
    require_stripe()
    if not org.stripe_account_id:
        raise ValidationError({'detail': 'Connect account not set up.', 'code': 'connect_missing'})
    try:
        balance = stripe.Balance.retrieve(stripe_account=org.stripe_account_id)
    except stripe.error.StripeError as exc:
        _raise_stripe_error(exc)

    def _sum_buckets(entries):
        total = 0
        currency = 'cad'
        for row in entries or []:
            total += int(row.get('amount') or 0)
            currency = (row.get('currency') or currency).lower()
        return total, currency

    available_cents, currency = _sum_buckets(balance.get('available'))
    instant_cents, inst_currency = _sum_buckets(balance.get('instant_available'))
    if instant_cents:
        currency = inst_currency or currency

    return {
        'instant_available_cents': instant_cents,
        'available_cents': available_cents,
        'currency': currency,
        'instant_supported': instant_cents > 0,
        'detail': (
            'Instant payout available.'
            if instant_cents > 0
            else (
                'No Instant Payout balance right now. Funds may still be pending, '
                'or Instant Payouts may not be enabled for this Stripe account/country.'
            )
        ),
    }


def create_instant_payout(org: Organization, *, amount_cents: int | None = None) -> dict:
    """
    Pay out Connect balance with method=instant.
    Stripe eligibility varies by country/account; errors are surfaced as ValidationError.
    """
    require_stripe()
    if not org.stripe_account_id:
        raise ValidationError({'detail': 'Connect account not set up.', 'code': 'connect_missing'})
    if not org.stripe_payouts_enabled:
        raise ValidationError({
            'detail': 'Payouts are not enabled on this Stripe account yet.',
            'code': 'payouts_disabled',
        })

    bal = connect_payout_balance(org)
    instant = int(bal['instant_available_cents'] or 0)
    currency = bal['currency'] or 'cad'
    if instant <= 0:
        raise ValidationError({
            'detail': bal.get('detail') or 'No Instant Payout balance available.',
            'code': 'instant_unavailable',
        })
    amount = int(amount_cents) if amount_cents is not None else instant
    if amount <= 0:
        raise ValidationError({'amount': 'Amount must be greater than zero.'})
    if amount > instant:
        raise ValidationError({
            'amount': f'Maximum Instant Payout is {instant / 100:.2f} {currency.upper()}.',
        })

    try:
        payout = stripe.Payout.create(
            amount=amount,
            currency=currency,
            method='instant',
            stripe_account=org.stripe_account_id,
        )
    except stripe.error.StripeError as exc:
        _raise_stripe_error(exc)

    return {
        'payout_id': payout.id,
        'amount_cents': amount,
        'currency': currency,
        'status': payout.get('status') or '',
        'arrival_date': payout.get('arrival_date'),
    }
