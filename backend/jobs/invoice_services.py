"""Create and update booking invoices (basic POS + tax from business address)."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from businesses.models import OrganizationMembership

from .models import Booking, Invoice, Service
from .tax_rates import calculate_tax_for_organization


def _parse_amount(value) -> Decimal:
    if value is None or value == '':
        raise ValidationError({'amount': 'Amount is required.'})
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({'amount': 'Enter a valid amount.'}) from exc
    if amount < 0:
        raise ValidationError({'amount': 'Amount cannot be negative.'})
    return amount.quantize(Decimal('0.01'))


def default_invoice_amount(booking: Booking) -> Decimal:
    """Best default pre-tax subtotal from the service catalog."""
    service = booking.service
    if not service:
        return Decimal('0.00')
    if service.pricing_type == Service.PricingType.QUOTE:
        return Decimal('0.00')
    return Decimal(service.base_price or 0).quantize(Decimal('0.01'))


def suggested_invoice_payload(booking: Booking) -> dict:
    service = booking.service
    pricing_type = getattr(service, 'pricing_type', Service.PricingType.FIXED) or Service.PricingType.FIXED
    estimated = Decimal(service.base_price or 0) if service else Decimal('0.00')
    estimated_max = None
    if service and pricing_type == Service.PricingType.RANGE and service.price_max is not None:
        estimated_max = Decimal(service.price_max)
    subtotal = default_invoice_amount(booking)
    tax = calculate_tax_for_organization(booking.organization, subtotal)
    return {
        'pricing_type': pricing_type,
        'estimated_amount': estimated.quantize(Decimal('0.01')),
        'estimated_max': estimated_max.quantize(Decimal('0.01')) if estimated_max is not None else None,
        'subtotal': tax['subtotal'],
        'amount': tax['total'],  # total due (backward-compatible key)
        'tax_total': tax['tax_total'],
        'tax_lines': tax['tax_lines'],
        'tax_country': tax['tax_country'],
        'tax_region': tax['tax_region'],
        'currency': tax['currency'],
        'business_state': tax.get('business_state') or '',
        'business_city': tax.get('business_city') or '',
        'description': (service.name if service else 'Service')[:255],
    }


def _assert_staff(user, organization):
    if not OrganizationMembership.objects.filter(
        organization=organization,
        user=user,
        role__in=(
            OrganizationMembership.Role.OWNER,
            OrganizationMembership.Role.STAFF,
        ),
    ).exists():
        raise PermissionDenied('Only staff can manage invoices.')


def _serialize_money(value) -> str | None:
    if value is None:
        return None
    return str(Decimal(value).quantize(Decimal('0.01')))


@transaction.atomic
def issue_or_update_invoice(
    booking: Booking,
    *,
    staff_user,
    amount=None,
    subtotal=None,
    notes: str = '',
    mark_paid: bool = False,
    description: str = '',
) -> Invoice:
    """
    Create or update the invoice for a booking. Staff only.

    `subtotal` is the pre-tax POS amount. If only `amount` is provided (legacy),
    it is treated as the pre-tax subtotal and tax is calculated from the
    business address.
    """
    _assert_staff(staff_user, booking.organization)
    if booking.status not in (
        Booking.Status.COMPLETED,
        Booking.Status.IN_PROGRESS,
        Booking.Status.CONFIRMED,
    ):
        raise ValidationError({
            'status': 'Invoices can only be issued for confirmed, in-progress, or completed bookings.',
        })

    raw_subtotal = subtotal if subtotal not in (None, '') else amount
    pre_tax = _parse_amount(raw_subtotal)
    tax = calculate_tax_for_organization(booking.organization, pre_tax)
    snapshot = suggested_invoice_payload(booking)
    desc = (description or snapshot['description'] or 'Service')[:255]
    note_text = (notes or '').strip()

    try:
        invoice = Invoice.objects.select_for_update().get(booking_id=booking.pk)
    except Invoice.DoesNotExist:
        invoice = None

    fields = {
        'pricing_type': snapshot['pricing_type'],
        'estimated_amount': snapshot['estimated_amount'],
        'estimated_max': snapshot['estimated_max'],
        'subtotal': tax['subtotal'],
        'amount': tax['total'],
        'tax_total': tax['tax_total'],
        'tax_lines': tax['tax_lines'],
        'tax_country': tax['tax_country'],
        'tax_region': tax['tax_region'],
        'currency': tax['currency'],
        'description': desc,
        'notes': note_text,
    }

    if invoice is None:
        invoice = Invoice(
            booking=booking,
            number=f'INV-{booking.pk:05d}',
            issued_by=staff_user,
            status=Invoice.Status.PAID if mark_paid else Invoice.Status.ISSUED,
            paid_at=timezone.now() if mark_paid else None,
            **fields,
        )
        invoice.save()
    else:
        if invoice.status == Invoice.Status.VOID:
            raise ValidationError({'status': 'This invoice was voided.'})
        for key, value in fields.items():
            setattr(invoice, key, value)
        if mark_paid:
            invoice.status = Invoice.Status.PAID
            if not invoice.paid_at:
                invoice.paid_at = timezone.now()
        elif invoice.status != Invoice.Status.PAID:
            invoice.status = Invoice.Status.ISSUED
        invoice.save()

    return invoice


@transaction.atomic
def mark_invoice_paid(invoice: Invoice, *, staff_user) -> Invoice:
    _assert_staff(staff_user, invoice.booking.organization)
    if invoice.status == Invoice.Status.VOID:
        raise ValidationError({'status': 'Cannot mark a void invoice as paid.'})
    invoice.status = Invoice.Status.PAID
    if not invoice.paid_at:
        invoice.paid_at = timezone.now()
    invoice.save(update_fields=['status', 'paid_at', 'updated_at'])
    return invoice
