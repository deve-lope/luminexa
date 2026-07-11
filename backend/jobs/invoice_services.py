"""Create and update booking invoices."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from businesses.models import OrganizationMembership

from .models import Booking, Invoice, Service


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
    """Best default final amount from the service catalog."""
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
    return {
        'pricing_type': pricing_type,
        'estimated_amount': estimated.quantize(Decimal('0.01')),
        'estimated_max': estimated_max.quantize(Decimal('0.01')) if estimated_max is not None else None,
        'amount': default_invoice_amount(booking),
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


@transaction.atomic
def issue_or_update_invoice(
    booking: Booking,
    *,
    staff_user,
    amount,
    notes: str = '',
    mark_paid: bool = False,
    description: str = '',
) -> Invoice:
    """Create or update the invoice for a booking. Staff only."""
    _assert_staff(staff_user, booking.organization)
    if booking.status not in (
        Booking.Status.COMPLETED,
        Booking.Status.IN_PROGRESS,
        Booking.Status.CONFIRMED,
    ):
        raise ValidationError({
            'status': 'Invoices can only be issued for confirmed, in-progress, or completed bookings.',
        })

    final_amount = _parse_amount(amount)
    snapshot = suggested_invoice_payload(booking)
    desc = (description or snapshot['description'] or 'Service')[:255]
    note_text = (notes or '').strip()

    invoice = None
    try:
        invoice = Invoice.objects.select_for_update().get(booking_id=booking.pk)
    except Invoice.DoesNotExist:
        invoice = None

    if invoice is None:
        invoice = Invoice(
            booking=booking,
            number=f'INV-{booking.pk:05d}',
            pricing_type=snapshot['pricing_type'],
            estimated_amount=snapshot['estimated_amount'],
            estimated_max=snapshot['estimated_max'],
            amount=final_amount,
            description=desc,
            notes=note_text,
            issued_by=staff_user,
            status=Invoice.Status.PAID if mark_paid else Invoice.Status.ISSUED,
            paid_at=timezone.now() if mark_paid else None,
        )
        invoice.save()
    else:
        if invoice.status == Invoice.Status.VOID:
            raise ValidationError({'status': 'This invoice was voided.'})
        invoice.amount = final_amount
        invoice.description = desc
        invoice.notes = note_text
        invoice.pricing_type = snapshot['pricing_type']
        invoice.estimated_amount = snapshot['estimated_amount']
        invoice.estimated_max = snapshot['estimated_max']
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
