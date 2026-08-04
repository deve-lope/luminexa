"""Job costing helpers — internal costs on bookings (not customer invoice lines)."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum, F, ExpressionWrapper, DecimalField
from rest_framework.exceptions import ValidationError

from .models import Booking, Invoice, JobCostLine


def _money(value) -> Decimal:
    if value is None:
        return Decimal('0.00')
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def booking_revenue(booking: Booking) -> Decimal:
    """Best-effort revenue for profit: paid/issued invoice, else quote amount."""
    try:
        inv = booking.invoice
    except Invoice.DoesNotExist:
        inv = None
    if inv is not None and inv.status in (Invoice.Status.PAID, Invoice.Status.ISSUED):
        return _money(inv.amount)
    if booking.quote_amount is not None:
        return _money(booking.quote_amount)
    return Decimal('0.00')


def booking_cost_total(booking: Booking) -> Decimal:
    total = (
        JobCostLine.objects.filter(booking=booking)
        .annotate(
            line_total=ExpressionWrapper(
                F('quantity') * F('unit_cost'),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        )
        .aggregate(s=Sum('line_total'))['s']
    )
    return _money(total)


def booking_profit_summary(booking: Booking) -> dict:
    revenue = booking_revenue(booking)
    costs = booking_cost_total(booking)
    profit = _money(revenue - costs)
    margin = None
    if revenue > 0:
        margin = float((profit / revenue * Decimal('100')).quantize(Decimal('0.1')))
    return {
        'revenue': str(revenue),
        'costs': str(costs),
        'profit': str(profit),
        'margin_percent': margin,
    }


def create_cost_line(booking: Booking, *, staff_user, data: dict) -> JobCostLine:
    kind = (data.get('kind') or JobCostLine.Kind.EXPENSE).lower()
    if kind not in JobCostLine.Kind.values:
        raise ValidationError({'kind': 'Use material, labor, or expense.'})
    description = (data.get('description') or '').strip()
    if not description:
        raise ValidationError({'description': 'Required.'})
    try:
        quantity = _money(data.get('quantity', '1'))
        unit_cost = _money(data.get('unit_cost', '0'))
    except Exception as exc:
        raise ValidationError({'detail': 'Invalid quantity or unit_cost.'}) from exc
    if quantity <= 0:
        raise ValidationError({'quantity': 'Must be greater than zero.'})
    if unit_cost < 0:
        raise ValidationError({'unit_cost': 'Cannot be negative.'})
    return JobCostLine.objects.create(
        booking=booking,
        kind=kind,
        description=description[:255],
        quantity=quantity,
        unit_cost=unit_cost,
        created_by=staff_user,
    )


def org_costs_in_range(org, start, end) -> Decimal:
    qs = JobCostLine.objects.filter(booking__organization=org)
    if start is not None:
        qs = qs.filter(booking__start_at__gte=start)
    if end is not None:
        qs = qs.filter(booking__start_at__lt=end)
    total = qs.annotate(
        line_total=ExpressionWrapper(
            F('quantity') * F('unit_cost'),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )
    ).aggregate(s=Sum('line_total'))['s']
    return _money(total)


def org_platform_fees_in_range(org, start, end) -> Decimal:
    """Sum of Luminexa platform fees on paid invoices collected in range (dollars)."""
    qs = Invoice.objects.filter(
        booking__organization=org,
        status=Invoice.Status.PAID,
        platform_fee_cents__isnull=False,
    )
    from django.db.models.functions import Coalesce

    qs = qs.annotate(collected_at=Coalesce('paid_at', 'issued_at'))
    if start is not None:
        qs = qs.filter(collected_at__gte=start)
    if end is not None:
        qs = qs.filter(collected_at__lt=end)
    cents = qs.aggregate(s=Sum('platform_fee_cents'))['s'] or 0
    return _money(Decimal(cents) / Decimal('100'))
