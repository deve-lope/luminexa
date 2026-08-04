"""Provider business analytics (gigs, income, customers, ratings)."""

from __future__ import annotations

from datetime import timedelta, timezone as dt_timezone
from decimal import Decimal

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Sum
from django.db.models.functions import Coalesce, TruncDay, TruncMonth
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from businesses.models import Organization

from .models import Booking, Invoice, ServiceReview
from .permissions import is_org_staff
from .ratings import RATING_DIMENSIONS

VALID_PERIODS = frozenset({'week', 'month', 'year', 'all'})


def _as_money(value) -> str:
    if value is None:
        return '0.00'
    return f'{Decimal(value).quantize(Decimal("0.01"))}'


def _as_hours(delta_seconds) -> float:
    if not delta_seconds:
        return 0.0
    return round(float(delta_seconds) / 3600.0, 1)


def _period_bounds(period: str, now, tz):
    """Return (start, end) aware datetimes for the selected period in org TZ."""
    local_now = timezone.localtime(now, tz)
    end = now

    if period == 'all':
        return None, end

    if period == 'week':
        # Monday 00:00 local → now
        start_local = (local_now - timedelta(days=local_now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )
    elif period == 'month':
        start_local = local_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == 'year':
        start_local = local_now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        raise ValidationError({'period': 'Must be week, month, year, or all.'})

    if timezone.is_naive(start_local):
        start_local = timezone.make_aware(start_local, tz)
    start = start_local.astimezone(dt_timezone.utc)
    return start, end


def _previous_bounds(period: str, start, end, tz):
    if period == 'all' or start is None:
        return None, None
    duration = end - start
    prev_end = start
    prev_start = start - duration
    return prev_start, prev_end


def _filter_range(qs, field: str, start, end):
    if start is not None:
        qs = qs.filter(**{f'{field}__gte': start})
    if end is not None:
        qs = qs.filter(**{f'{field}__lt': end})
    return qs


def _completed_qs(org, start, end):
    qs = Booking.objects.filter(
        organization=org,
        status=Booking.Status.COMPLETED,
    )
    return _filter_range(qs, 'start_at', start, end)


def _hours_for_bookings(qs) -> float:
    annotated = qs.annotate(
        duration=ExpressionWrapper(F('end_at') - F('start_at'), output_field=DurationField()),
    ).aggregate(total=Sum('duration'))
    total = annotated['total']
    if total is None:
        return 0.0
    return _as_hours(total.total_seconds())


def _income_paid(org, start, end) -> Decimal:
    qs = Invoice.objects.filter(
        booking__organization=org,
        status=Invoice.Status.PAID,
    ).annotate(
        collected_at=Coalesce('paid_at', 'issued_at'),
    )
    if start is not None:
        qs = qs.filter(collected_at__gte=start)
    if end is not None:
        qs = qs.filter(collected_at__lt=end)
    return qs.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')


def _income_outstanding(org) -> Decimal:
    return (
        Invoice.objects.filter(
            booking__organization=org,
            status=Invoice.Status.ISSUED,
        ).aggregate(total=Sum('amount'))['total']
        or Decimal('0.00')
    )


def _customer_stats(completed_qs):
    """Unique + recurring (2+ completed all-time) among customers who completed in-range."""
    # Clear model Meta.ordering so DISTINCT on customer_id is not widened by start_at.
    period_customer_ids = list(
        completed_qs.order_by()
        .values_list('customer_id', flat=True)
        .distinct()
    )
    unique = len(period_customer_ids)
    if not unique:
        return 0, 0, 0.0

    org_id = completed_qs.values_list('organization_id', flat=True).first()
    recurring_ids = set(
        Booking.objects.filter(
            organization_id=org_id,
            status=Booking.Status.COMPLETED,
            customer_id__in=period_customer_ids,
        )
        .order_by()
        .values('customer_id')
        .annotate(n=Count('id'))
        .filter(n__gte=2)
        .values_list('customer_id', flat=True)
    )
    recurring = len(recurring_ids)
    rate = round(100.0 * recurring / unique, 1) if unique else 0.0
    return unique, recurring, rate


def _conversion_stats(org, start, end):
    """Bookings created in range: completed vs terminal outcomes."""
    qs = Booking.objects.filter(organization=org)
    qs = _filter_range(qs, 'created_at', start, end)
    total = qs.count()
    if not total:
        return {
            'requests_received': 0,
            'completed': 0,
            'cancelled': 0,
            'conversion_rate': 0.0,
        }
    completed = qs.filter(status=Booking.Status.COMPLETED).count()
    cancelled = qs.filter(status=Booking.Status.CANCELLED).count()
    # Conversion among bookings that reached a terminal-ish outcome
    decided = completed + cancelled
    rate = round(100.0 * completed / decided, 1) if decided else 0.0
    return {
        'requests_received': total,
        'completed': completed,
        'cancelled': cancelled,
        'conversion_rate': rate,
    }


def _rating_summary(org, start, end):
    qs = ServiceReview.objects.filter(service__organization=org)
    qs = _filter_range(qs, 'created_at', start, end)
    agg = qs.aggregate(
        count=Count('id'),
        **{dim: Avg(dim) for dim in RATING_DIMENSIONS},
    )
    count = agg['count'] or 0
    if not count:
        return {'count': 0, 'average': None}
    dims = [
        float(agg[d]) for d in RATING_DIMENSIONS if agg[d] is not None
    ]
    average = round(sum(dims) / len(dims), 1) if dims else None
    return {'count': count, 'average': average}


def _avg_job_value(org, start, end) -> Decimal | None:
    qs = Invoice.objects.filter(
        booking__organization=org,
        status__in=(Invoice.Status.PAID, Invoice.Status.ISSUED),
        booking__status=Booking.Status.COMPLETED,
    )
    qs = _filter_range(qs, 'booking__start_at', start, end)
    avg = qs.aggregate(avg=Avg('amount'))['avg']
    if avg is None:
        return None
    return Decimal(avg).quantize(Decimal('0.01'))


def _build_series(org, period, start, end, tz):
    completed = _completed_qs(org, start, end)
    if period in ('week', 'month'):
        trunc = TruncDay('start_at', tzinfo=tz)
        label_fmt = '%Y-%m-%d'
    else:
        trunc = TruncMonth('start_at', tzinfo=tz)
        label_fmt = '%Y-%m'

    gig_rows = (
        completed.annotate(bucket=trunc)
        .values('bucket')
        .annotate(gigs=Count('id'))
        .order_by('bucket')
    )
    gig_map = {
        row['bucket'].astimezone(tz).strftime(label_fmt) if row['bucket'] else '': row['gigs']
        for row in gig_rows
        if row['bucket']
    }

    paid = (
        Invoice.objects.filter(
            booking__organization=org,
            status=Invoice.Status.PAID,
        )
        .annotate(collected_at=Coalesce('paid_at', 'issued_at'))
    )
    if start is not None:
        paid = paid.filter(collected_at__gte=start)
    if end is not None:
        paid = paid.filter(collected_at__lt=end)

    if period in ('week', 'month'):
        income_trunc = TruncDay('collected_at', tzinfo=tz)
    else:
        income_trunc = TruncMonth('collected_at', tzinfo=tz)

    income_rows = (
        paid.annotate(bucket=income_trunc)
        .values('bucket')
        .annotate(income=Sum('amount'))
        .order_by('bucket')
    )
    income_map = {
        row['bucket'].astimezone(tz).strftime(label_fmt) if row['bucket'] else '': row['income']
        for row in income_rows
        if row['bucket']
    }

    labels = _series_labels(period, start, end, tz, label_fmt)
    series = []
    for label in labels:
        series.append({
            'label': label,
            'gigs': gig_map.get(label, 0),
            'income': _as_money(income_map.get(label)),
        })
    return series


def _series_labels(period, start, end, tz, label_fmt):
    if start is None:
        # Last 12 months for all-time chart
        local_end = timezone.localtime(end, tz)
        labels = []
        y, m = local_end.year, local_end.month
        for _ in range(12):
            labels.append(f'{y:04d}-{m:02d}')
            m -= 1
            if m == 0:
                m = 12
                y -= 1
        labels.reverse()
        return labels

    local_start = timezone.localtime(start, tz)
    local_end = timezone.localtime(end, tz)
    labels = []

    if period in ('week', 'month'):
        cursor = local_start.date()
        end_date = local_end.date()
        while cursor <= end_date:
            labels.append(cursor.strftime('%Y-%m-%d'))
            cursor += timedelta(days=1)
        return labels

    # year: months from Jan (or start) through current month
    y, m = local_start.year, local_start.month
    end_y, end_m = local_end.year, local_end.month
    while (y, m) <= (end_y, end_m):
        labels.append(f'{y:04d}-{m:02d}')
        m += 1
        if m == 13:
            m = 1
            y += 1
    return labels


def _by_service(org, start, end):
    qs = _completed_qs(org, start, end)
    rows = (
        qs.values('service_id', 'service__name')
        .annotate(
            gigs=Count('id'),
            duration=Sum(
                ExpressionWrapper(F('end_at') - F('start_at'), output_field=DurationField())
            ),
        )
        .order_by('-gigs')
    )
    # Income per service from paid/issued invoices on completed bookings in range
    income_rows = (
        Invoice.objects.filter(
            booking__organization=org,
            booking__status=Booking.Status.COMPLETED,
            status__in=(Invoice.Status.PAID, Invoice.Status.ISSUED),
        )
    )
    income_rows = _filter_range(income_rows, 'booking__start_at', start, end)
    income_map = {
        r['booking__service_id']: r['total']
        for r in income_rows.values('booking__service_id').annotate(total=Sum('amount'))
    }

    result = []
    for row in rows:
        dur = row['duration']
        hours = _as_hours(dur.total_seconds()) if dur else 0.0
        result.append({
            'service_id': row['service_id'],
            'service_name': row['service__name'],
            'gigs': row['gigs'],
            'hours': hours,
            'income': _as_money(income_map.get(row['service_id'])),
        })
    return result


def _top_customers(org, start, end, limit=5):
    qs = _completed_qs(org, start, end)
    rows = (
        qs.values('customer_id', 'customer__full_name', 'customer__email')
        .annotate(gigs=Count('id'))
        .order_by('-gigs')[:limit]
    )
    income_qs = Invoice.objects.filter(
        booking__organization=org,
        booking__status=Booking.Status.COMPLETED,
        status__in=(Invoice.Status.PAID, Invoice.Status.ISSUED),
    )
    income_qs = _filter_range(income_qs, 'booking__start_at', start, end)
    income_map = {
        r['booking__customer_id']: r['total']
        for r in income_qs.values('booking__customer_id').annotate(total=Sum('amount'))
    }
    return [
        {
            'customer_id': row['customer_id'],
            'full_name': row['customer__full_name'] or row['customer__email'] or 'Customer',
            'gigs': row['gigs'],
            'income': _as_money(income_map.get(row['customer_id'])),
        }
        for row in rows
    ]


def _summary_block(org, start, end):
    from .job_costing_services import (
        org_costs_in_range,
        org_platform_fees_in_range,
    )

    completed = _completed_qs(org, start, end)
    gigs = completed.count()
    hours = _hours_for_bookings(completed)
    income = _income_paid(org, start, end)
    costs = org_costs_in_range(org, start, end)
    platform_fees = org_platform_fees_in_range(org, start, end)
    profit = (income - costs - platform_fees).quantize(Decimal('0.01'))
    unique, recurring, recurring_rate = _customer_stats(completed)
    conversion = _conversion_stats(org, start, end)
    rating = _rating_summary(org, start, end)
    avg_value = _avg_job_value(org, start, end)
    needs_return = Booking.objects.filter(
        organization=org,
        status=Booking.Status.NEEDS_RETURN,
    ).count()
    quoted_value = (
        Booking.objects.filter(
            organization=org,
            status=Booking.Status.QUOTED,
            quote_amount__isnull=False,
        ).aggregate(total=Sum('quote_amount'))['total']
        or Decimal('0.00')
    )

    return {
        'gigs_completed': gigs,
        'income_collected': _as_money(income),
        'income_outstanding': _as_money(_income_outstanding(org)),
        'job_costs': _as_money(costs),
        'platform_fees': _as_money(platform_fees),
        'profit': _as_money(profit),
        'quoted_pipeline': _as_money(quoted_value),
        'hours_spent': hours,
        'unique_customers': unique,
        'recurring_customers': recurring,
        'recurring_rate': recurring_rate,
        'avg_job_value': _as_money(avg_value) if avg_value is not None else None,
        'needs_return_open': needs_return,
        'avg_rating': rating['average'],
        'review_count': rating['count'],
        **conversion,
    }


def _ar_aging(org):
    """Unpaid issued invoices bucketed by days since issue."""
    now = timezone.now()
    buckets = {
        'current': Decimal('0.00'),
        'days_1_30': Decimal('0.00'),
        'days_31_60': Decimal('0.00'),
        'days_60_plus': Decimal('0.00'),
        'count': 0,
    }
    for inv in Invoice.objects.filter(
        booking__organization=org,
        status=Invoice.Status.ISSUED,
    ).only('amount', 'issued_at'):
        buckets['count'] += 1
        amount = inv.amount or Decimal('0.00')
        days = (now - inv.issued_at).days if inv.issued_at else 0
        if days <= 0:
            buckets['current'] += amount
        elif days <= 30:
            buckets['days_1_30'] += amount
        elif days <= 60:
            buckets['days_31_60'] += amount
        else:
            buckets['days_60_plus'] += amount
    return {
        'current': _as_money(buckets['current']),
        'days_1_30': _as_money(buckets['days_1_30']),
        'days_31_60': _as_money(buckets['days_31_60']),
        'days_60_plus': _as_money(buckets['days_60_plus']),
        'count': buckets['count'],
        'total': _as_money(
            buckets['current']
            + buckets['days_1_30']
            + buckets['days_31_60']
            + buckets['days_60_plus']
        ),
    }


def _pct_change(current, previous):
    if previous in (None, 0, '0.00', 0.0):
        if current in (None, 0, '0.00', 0.0):
            return None
        return None  # no baseline
    try:
        cur = float(current)
        prev = float(previous)
    except (TypeError, ValueError):
        return None
    if prev == 0:
        return None
    return round(100.0 * (cur - prev) / prev, 1)


class ProviderAnalyticsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        slug = request.query_params.get('organization')
        if not slug:
            raise ValidationError({'organization': "Query parameter 'organization' (slug) is required."})
        period = (request.query_params.get('period') or 'month').lower()
        if period not in VALID_PERIODS:
            raise ValidationError({'period': 'Must be week, month, year, or all.'})

        org = Organization.objects.filter(slug=slug).first()
        if not org:
            raise NotFound('Organization not found.')
        if not is_org_staff(request.user, org):
            raise PermissionDenied('You must be staff of this organization to view analytics.')
        from .permissions import require_provider_subscription
        require_provider_subscription(org)

        now = timezone.now()
        tz = org.get_timezone()
        start, end = _period_bounds(period, now, tz)
        prev_start, prev_end = _previous_bounds(period, start, end, tz)

        summary = _summary_block(org, start, end)
        previous = _summary_block(org, prev_start, prev_end) if prev_start is not None else None
        totals = _summary_block(org, None, end)

        compare = None
        if previous:
            compare = {
                'gigs_completed': _pct_change(summary['gigs_completed'], previous['gigs_completed']),
                'income_collected': _pct_change(summary['income_collected'], previous['income_collected']),
                'hours_spent': _pct_change(summary['hours_spent'], previous['hours_spent']),
                'unique_customers': _pct_change(summary['unique_customers'], previous['unique_customers']),
                'profit': _pct_change(summary['profit'], previous['profit']),
            }

        # Prefer currency from a recent invoice; default CAD
        currency = (
            Invoice.objects.filter(booking__organization=org)
            .order_by('-issued_at')
            .values_list('currency', flat=True)
            .first()
        ) or 'CAD'

        return Response({
            'organization': {
                'id': org.id,
                'name': org.name,
                'slug': org.slug,
                'timezone': org.timezone or 'UTC',
            },
            'period': period,
            'range': {
                'start': start.isoformat() if start else None,
                'end': end.isoformat(),
            },
            'currency': currency,
            'summary': summary,
            'previous': previous,
            'compare': compare,
            'totals': totals,
            'ar_aging': _ar_aging(org),
            'series': _build_series(org, period, start, end, tz),
            'by_service': _by_service(org, start, end),
            'top_customers': _top_customers(org, start, end),
        })


class ProviderBooksExportAPIView(APIView):
    """CSV export of invoices, payments, and job costs for the period."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        import csv
        from io import StringIO

        from django.http import HttpResponse

        from .models import JobCostLine
        from .permissions import require_provider_subscription

        slug = request.query_params.get('organization')
        if not slug:
            raise ValidationError({'organization': "Query parameter 'organization' (slug) is required."})
        period = (request.query_params.get('period') or 'month').lower()
        if period not in VALID_PERIODS:
            raise ValidationError({'period': 'Must be week, month, year, or all.'})

        org = Organization.objects.filter(slug=slug).first()
        if not org:
            raise NotFound('Organization not found.')
        if not is_org_staff(request.user, org):
            raise PermissionDenied('Staff only.')
        require_provider_subscription(org)

        now = timezone.now()
        tz = org.get_timezone()
        start, end = _period_bounds(period, now, tz)

        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(['section', 'date', 'reference', 'customer', 'description', 'amount', 'status', 'kind'])

        invoices = Invoice.objects.filter(booking__organization=org).select_related(
            'booking', 'booking__customer', 'booking__service',
        )
        if start is not None:
            invoices = invoices.filter(issued_at__gte=start)
        if end is not None:
            invoices = invoices.filter(issued_at__lt=end)
        for inv in invoices.order_by('issued_at'):
            writer.writerow([
                'invoice',
                inv.issued_at.isoformat() if inv.issued_at else '',
                inv.number,
                inv.booking.customer.full_name or inv.booking.customer.email,
                inv.description or (inv.booking.service.name if inv.booking.service_id else ''),
                str(inv.amount),
                inv.status,
                inv.payment_method or '',
            ])

        costs = JobCostLine.objects.filter(booking__organization=org).select_related(
            'booking', 'booking__customer', 'booking__service',
        )
        if start is not None:
            costs = costs.filter(booking__start_at__gte=start)
        if end is not None:
            costs = costs.filter(booking__start_at__lt=end)
        for line in costs.order_by('booking__start_at', 'id'):
            writer.writerow([
                'cost',
                line.booking.start_at.isoformat() if line.booking.start_at else '',
                f'BK-{line.booking_id:05d}',
                line.booking.customer.full_name or line.booking.customer.email,
                line.description,
                str(line.total_cost),
                '',
                line.kind,
            ])

        response = HttpResponse(buffer.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="luminexa-books-{org.slug}-{period}.csv"'
        )
        return response


class OrganizationDataExportAPIView(APIView):
    """
    Complete organization data export for business migration/backup.
    
    Supports JSON, CSV (ZIP), and Excel formats. Owner-only, Pro subscription required.
    """

    permission_classes = [IsAuthenticated]
    # Allow ?format=json|csv|excel without DRF content-negotiation hijacking it.
    format_kwarg = None

    def get(self, request, slug):
        from django.http import HttpResponse

        from businesses.models import OrganizationMembership

        from .data_export_services import (
            collect_organization_data,
            export_as_csv_zip,
            export_as_excel,
            export_as_json,
        )
        from .permissions import require_provider_subscription

        export_format = (
            request.query_params.get('export_format')
            or request.query_params.get('fmt')
            or 'json'
        ).lower()
        if export_format not in ('json', 'csv', 'excel'):
            raise ValidationError({'export_format': 'Must be json, csv, or excel.'})

        org = Organization.objects.filter(slug=slug).first()
        if not org:
            raise NotFound('Organization not found.')

        # Owner-only permission
        membership = OrganizationMembership.objects.filter(
            user=request.user,
            organization=org,
            role=OrganizationMembership.Role.OWNER,
        ).first()
        if not membership:
            raise PermissionDenied('Only the organization owner can export business data.')

        # Active Pro subscription required
        require_provider_subscription(org)
        plan = (org.subscription_plan or 'free').lower()
        if not plan.startswith('pro'):
            raise PermissionDenied('Pro subscription required to export business data.')

        # Collect all data
        data = collect_organization_data(org)

        # Export in requested format
        if export_format == 'json':
            content = export_as_json(data)
            content_type = 'application/json'
            filename = f'{org.slug}-export-{timezone.now().strftime("%Y-%m-%d")}.json'
        elif export_format == 'csv':
            content = export_as_csv_zip(data)
            content_type = 'application/zip'
            filename = f'{org.slug}-export-{timezone.now().strftime("%Y-%m-%d")}.zip'
        else:  # excel
            content = export_as_excel(data)
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            filename = f'{org.slug}-export-{timezone.now().strftime("%Y-%m-%d")}.xlsx'

        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
