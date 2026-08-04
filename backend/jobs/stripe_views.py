"""Stripe Connect onboarding, invoice Checkout, subscriptions, and webhooks."""

from __future__ import annotations

import logging

import stripe
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.models import Organization, OrganizationMembership

from . import stripe_services
from .models import Invoice
from .permissions import is_org_staff, membership_for

logger = logging.getLogger(__name__)


def _org_for_owner(user, slug: str) -> Organization:
    org = get_object_or_404(Organization, slug=slug)
    m = membership_for(user, org)
    if not m or m.role != OrganizationMembership.Role.OWNER:
        raise PermissionDenied('Only the business owner can manage payments.')
    return org


class OrgBillingSummaryAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        org = get_object_or_404(Organization, slug=slug)
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Staff only.')
        if org.stripe_account_id and stripe_services.stripe_configured():
            try:
                stripe_services.refresh_connect_account(org)
                org.refresh_from_db()
            except Exception:
                logger.exception('Failed to refresh Connect account for org %s', org.slug)
        return Response(stripe_services.billing_summary(org))


class ConnectOnboardingAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        org = _org_for_owner(request.user, slug)
        return_path = request.data.get('return_path') or f'/provider/{org.slug}/settings'
        url = stripe_services.create_connect_onboarding_link(
            org,
            owner_email=request.user.email or '',
            return_path=return_path,
        )
        return Response({'url': url})


class ConnectLoginAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        org = _org_for_owner(request.user, slug)
        url = stripe_services.create_connect_login_link(org)
        return Response({'url': url})


class SubscriptionCheckoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        org = _org_for_owner(request.user, slug)
        plan = (request.data.get('plan') or 'pro_monthly').strip()
        if plan not in ('pro_monthly', 'pro_yearly'):
            raise ValidationError({'plan': 'Choose pro_monthly or pro_yearly.'})
        result = stripe_services.create_subscription_checkout(
            org=org,
            owner_email=request.user.email or '',
            owner_name=request.user.full_name or '',
            plan=plan,
            success_path=request.data.get('success_path') or f'/provider/{org.slug}/settings',
            cancel_path=request.data.get('cancel_path') or f'/provider/{org.slug}/settings',
        )
        return Response(result)


class BillingPortalAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        org = _org_for_owner(request.user, slug)
        result = stripe_services.create_billing_portal_session(
            org=org,
            return_path=request.data.get('return_path') or f'/provider/{org.slug}/settings',
        )
        return Response(result)


class SyncCheckoutSessionAPIView(APIView):
    """Owner syncs subscription status after Checkout redirect (before webhook arrives)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        org = _org_for_owner(request.user, slug)
        session_id = (request.data.get('session_id') or '').strip()
        stripe_services.sync_subscription_checkout_session(org=org, session_id=session_id)
        org.refresh_from_db()
        return Response(stripe_services.billing_summary(org))


class InvoicePayCheckoutAPIView(APIView):
    """Customer starts Stripe Checkout to pay an issued invoice."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from .models import Booking

        booking = get_object_or_404(
            Booking.objects.select_related('organization', 'service', 'customer', 'invoice'),
            pk=pk,
        )
        if booking.customer_id != request.user.id:
            raise PermissionDenied('Only the customer can pay this invoice.')
        try:
            invoice = booking.invoice
        except Invoice.DoesNotExist:
            return Response({'detail': 'No invoice yet.'}, status=status.HTTP_404_NOT_FOUND)

        org_slug = booking.organization.slug
        success = request.data.get('success_path') or f'/customer/bookings?org={org_slug}'
        cancel = request.data.get('cancel_path') or f'/customer/bookings?org={org_slug}'
        result = stripe_services.create_invoice_checkout_session(
            invoice=invoice,
            customer_user=request.user,
            success_path=success,
            cancel_path=cancel,
        )
        return Response(result)


class InvoicePaySyncAPIView(APIView):
    """Confirm payment immediately after Stripe redirects the customer back."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from .models import Booking
        from .serializers import InvoiceSerializer

        booking = get_object_or_404(
            Booking.objects.select_related('organization', 'service', 'customer', 'invoice'),
            pk=pk,
        )
        if booking.customer_id != request.user.id:
            raise PermissionDenied('Only the customer can confirm this payment.')
        try:
            invoice = booking.invoice
        except Invoice.DoesNotExist:
            return Response({'detail': 'No invoice yet.'}, status=status.HTTP_404_NOT_FOUND)
        invoice = stripe_services.sync_invoice_checkout_session(
            invoice=invoice,
            customer_user=request.user,
            session_id=(request.data.get('session_id') or '').strip(),
        )
        return Response(InvoiceSerializer(invoice, context={'request': request}).data)


class CustomerUnpaidInvoiceAPIView(APIView):
    """Newest unpaid online invoice used by the global customer payment prompt."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .serializers import InvoiceSerializer

        invoice = (
            Invoice.objects.filter(
                booking__customer=request.user,
                status=Invoice.Status.ISSUED,
            )
            .select_related('booking__organization', 'booking__service', 'booking__customer')
            .order_by('-issued_at')
            .first()
        )
        if invoice is None:
            return Response({'invoice': None})
        serialized = InvoiceSerializer(invoice, context={'request': request}).data
        if not serialized.get('can_pay_online'):
            return Response({'invoice': None})
        return Response({
            'booking_id': invoice.booking_id,
            'organization_name': invoice.booking.organization.name,
            'service_name': (
                invoice.booking.service.name
                if invoice.booking.service_id
                else invoice.description or 'Service'
            ),
            'invoice': serialized,
        })


@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def stripe_webhook(request):
    if not stripe_services.stripe_configured():
        return Response({'detail': 'Stripe not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')
    webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', '') or ''

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        elif settings.DEBUG:
            # Local/dev without signing secret only — never allow unsigned in production.
            import json
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
        else:
            logger.error('STRIPE_WEBHOOK_SECRET is required when Stripe is enabled outside DEBUG.')
            return Response(
                {
                    'detail': 'Webhook signing secret is required.',
                    'code': 'webhook_secret_required',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
    except ValueError:
        return Response({'detail': 'Invalid payload.'}, status=status.HTTP_400_BAD_REQUEST)
    except stripe.error.SignatureVerificationError:
        return Response({'detail': 'Invalid signature.'}, status=status.HTTP_400_BAD_REQUEST)

    event_type = event['type']
    data = event['data']['object']

    try:
        _handle_event(event_type, data)
    except Exception:
        logger.exception('Stripe webhook handler failed for %s', event_type)
        return Response({'detail': 'Handler error.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'received': True})


def _handle_event(event_type: str, data: dict) -> None:
    if event_type == 'checkout.session.completed':
        _on_checkout_completed(data)
    elif event_type in (
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
    ):
        _on_subscription(data)
    elif event_type == 'account.updated':
        _on_account_updated(data)
    elif event_type == 'payment_intent.succeeded':
        # Backup if checkout.session.completed was missed
        _on_payment_intent_succeeded(data)


def _on_checkout_completed(session: dict) -> None:
    kind = (session.get('metadata') or {}).get('kind')
    if kind == 'invoice_payment' or session.get('mode') == 'payment':
        # checkout.session.completed can fire before funds clear — only mark paid when paid.
        if session.get('payment_status') != 'paid':
            logger.info(
                'Ignoring invoice checkout %s with payment_status=%s',
                session.get('id'),
                session.get('payment_status'),
            )
            return
        invoice_id = (session.get('metadata') or {}).get('invoice_id')
        if not invoice_id:
            return
        try:
            invoice = Invoice.objects.select_related('booking').get(pk=invoice_id)
        except Invoice.DoesNotExist:
            logger.warning('Stripe checkout for unknown invoice %s', invoice_id)
            return
        pi = session.get('payment_intent') or ''
        if isinstance(pi, dict):
            pi = pi.get('id') or ''
        stripe_services.mark_invoice_paid_from_stripe(
            invoice=invoice,
            payment_intent_id=str(pi),
            session_id=session.get('id') or '',
        )
        return

    if kind == 'provider_subscription' or session.get('mode') == 'subscription':
        org_id = (session.get('metadata') or {}).get('organization_id')
        if not org_id:
            return
        org = Organization.objects.filter(pk=org_id).first()
        if not org:
            return
        sub_id = session.get('subscription')
        if isinstance(sub_id, dict):
            sub_id = sub_id.get('id')
        if sub_id:
            stripe_services.require_stripe()
            sub = stripe.Subscription.retrieve(sub_id)
            plan = (session.get('metadata') or {}).get('plan') or 'pro_monthly'
            if not (sub.get('metadata') or {}).get('plan'):
                # ensure plan metadata on subscription object path via local apply
                sub = dict(sub)
                meta = dict(sub.get('metadata') or {})
                meta['plan'] = plan
                sub['metadata'] = meta
            stripe_services.apply_subscription_from_stripe(org=org, subscription=sub)


def _on_subscription(subscription: dict) -> None:
    meta = subscription.get('metadata') or {}
    org_id = meta.get('organization_id')
    org = None
    if org_id:
        org = Organization.objects.filter(pk=org_id).first()
    if org is None and subscription.get('customer'):
        org = Organization.objects.filter(
            stripe_customer_id=subscription['customer'],
        ).first()
    if not org:
        logger.warning('Subscription event for unknown org: %s', subscription.get('id'))
        return
    stripe_services.apply_subscription_from_stripe(org=org, subscription=subscription)


def _on_account_updated(account: dict) -> None:
    account_id = account.get('id')
    if not account_id:
        return
    org = Organization.objects.filter(stripe_account_id=account_id).first()
    if not org:
        return
    org.stripe_charges_enabled = bool(account.get('charges_enabled'))
    org.stripe_payouts_enabled = bool(account.get('payouts_enabled'))
    org.stripe_details_submitted = bool(account.get('details_submitted'))
    org.save(update_fields=[
        'stripe_charges_enabled',
        'stripe_payouts_enabled',
        'stripe_details_submitted',
        'updated_at',
    ])


def _on_payment_intent_succeeded(pi: dict) -> None:
    invoice_id = (pi.get('metadata') or {}).get('invoice_id')
    if not invoice_id:
        return
    try:
        invoice = Invoice.objects.select_related('booking').get(pk=invoice_id)
    except Invoice.DoesNotExist:
        return
    if invoice.status == Invoice.Status.PAID:
        return
    stripe_services.mark_invoice_paid_from_stripe(
        invoice=invoice,
        payment_intent_id=pi.get('id') or '',
    )
