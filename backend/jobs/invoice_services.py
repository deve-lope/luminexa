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


def _parse_quantity(value) -> Decimal:
    if value in (None, ''):
        return Decimal('1')
    try:
        qty = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({'line_items': 'Quantity must be a number.'}) from exc
    if qty <= 0:
        raise ValidationError({'line_items': 'Quantity must be greater than zero.'})
    if qty == qty.to_integral_value():
        return qty.to_integral_value()
    return qty.quantize(Decimal('0.01'))


def normalize_line_items(raw_items) -> list[dict]:
    """Validate and normalize extra bill lines from the POS form."""
    if raw_items in (None, ''):
        return []
    if not isinstance(raw_items, list):
        raise ValidationError({'line_items': 'Expected a list of bill items.'})
    if len(raw_items) > 40:
        raise ValidationError({'line_items': 'Too many bill items (max 40).'})

    normalized = []
    for idx, item in enumerate(raw_items):
        if not isinstance(item, dict):
            raise ValidationError({'line_items': f'Item {idx + 1} must be an object.'})
        name = str(item.get('name') or '').strip()
        if not name:
            raise ValidationError({'line_items': f'Item {idx + 1} needs a name.'})
        item_type = str(item.get('type') or '').strip()[:80]
        brand = str(item.get('brand') or '').strip()[:80]
        quantity = _parse_quantity(item.get('quantity', 1))
        amount = _parse_amount(item.get('amount'))
        qty_out = int(quantity) if quantity == quantity.to_integral_value() else float(quantity)
        normalized.append({
            'name': name[:120],
            'type': item_type,
            'brand': brand,
            'quantity': qty_out,
            'amount': str(amount),
        })
    return normalized


def line_items_total(line_items: list[dict]) -> Decimal:
    total = Decimal('0.00')
    for item in line_items or []:
        total += _parse_amount(item.get('amount'))
    return total.quantize(Decimal('0.01'))


def default_invoice_amount(booking: Booking) -> Decimal:
    """Best default pre-tax service fee from the accepted quote or catalog."""
    if booking.quote_amount is not None:
        return Decimal(booking.quote_amount).quantize(Decimal('0.01'))
    service = booking.service
    if not service:
        return Decimal('0.00')
    if Service.pricing_requires_quote(service.pricing_type):
        # Estimate only — final fee should come from the accepted quote when present.
        return Decimal(service.base_price or 0).quantize(Decimal('0.01'))
    return Decimal(service.base_price or 0).quantize(Decimal('0.01'))


def suggested_invoice_payload(booking: Booking) -> dict:
    service = booking.service
    pricing_type = getattr(service, 'pricing_type', Service.PricingType.FIXED) or Service.PricingType.FIXED
    estimated = Decimal(service.base_price or 0) if service else Decimal('0.00')
    estimated_max = None
    if service and pricing_type == Service.PricingType.RANGE and service.price_max is not None:
        estimated_max = Decimal(service.price_max)
    service_fee = default_invoice_amount(booking)
    tax = calculate_tax_for_organization(booking.organization, service_fee)
    return {
        'pricing_type': pricing_type,
        'estimated_amount': estimated.quantize(Decimal('0.01')),
        'estimated_max': estimated_max.quantize(Decimal('0.01')) if estimated_max is not None else None,
        'service_fee': tax['subtotal'],
        'subtotal': tax['subtotal'],
        'amount': tax['total'],
        'tax_total': tax['tax_total'],
        'tax_lines': tax['tax_lines'],
        'tax_country': tax['tax_country'],
        'tax_region': tax['tax_region'],
        'currency': tax['currency'],
        'business_state': tax.get('business_state') or '',
        'business_city': tax.get('business_city') or '',
        'description': (service.name if service else 'Service')[:255],
        'line_items': [],
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


@transaction.atomic
def issue_or_update_invoice(
    booking: Booking,
    *,
    staff_user,
    amount=None,
    subtotal=None,
    service_fee=None,
    line_items=None,
    notes: str = '',
    mark_paid: bool = False,
    description: str = '',
) -> Invoice:
    """
    Create or update the invoice for a booking. Staff only.

    New POS flow: `service_fee` + `line_items` (extras) → pre-tax subtotal.
    Legacy: `subtotal` / `amount` as full pre-tax total.
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

    extras = normalize_line_items(line_items)
    extras_total = line_items_total(extras)

    if service_fee not in (None, ''):
        fee = _parse_amount(service_fee)
        pre_tax = (fee + extras_total).quantize(Decimal('0.01'))
    else:
        raw_subtotal = subtotal if subtotal not in (None, '') else amount
        if raw_subtotal in (None, ''):
            fee = default_invoice_amount(booking)
            pre_tax = (fee + extras_total).quantize(Decimal('0.01'))
        else:
            # Legacy full pre-tax total; still persist any extras for display.
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
        'line_items': extras,
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
def mark_invoice_paid(invoice: Invoice, *, staff_user=None) -> Invoice:
    """Mark paid. Pass staff_user for offline POS; omit for trusted Stripe webhooks."""
    if staff_user is not None:
        _assert_staff(staff_user, invoice.booking.organization)
    if invoice.status == Invoice.Status.VOID:
        raise ValidationError({'status': 'Cannot mark a void invoice as paid.'})
    invoice.status = Invoice.Status.PAID
    if not invoice.paid_at:
        invoice.paid_at = timezone.now()
    invoice.save(update_fields=['status', 'paid_at', 'updated_at'])
    return invoice
