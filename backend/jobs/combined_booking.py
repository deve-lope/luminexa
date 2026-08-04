"""
Combined multi-service visit: one start time, contiguous window = sum of durations.

PRODUCT_RULES does not forbid this; the prior per-service slot UX was an implementation
choice. Capacity still comes from Organization.concurrent_capacity (timeline overlap).
"""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ValidationError

from businesses.models import Organization

from .booking_lead import earliest_customer_bookable_at, is_slot_start_bookable_for_customer
from .booking_services import customer_request_slot
from .models import AvailabilitySlot, Booking, Service, UnavailableBlock

OCCUPYING_EXCLUDE = (
    Booking.Status.CANCELLED,
    Booking.Status.COMPLETED,
)


def total_duration_minutes(services) -> int:
    total = sum(int(s.duration_minutes or 0) for s in services)
    if total < 1:
        raise ValidationError({'services': 'Selected services need a total duration greater than zero.'})
    return total


def assert_same_fulfillment(services):
    kinds = {(s.fulfillment_kind or Service.FulfillmentKind.MOBILE) for s in services}
    if len(kinds) > 1:
        raise ValidationError({
            'services': (
                'Mobile and in-shop services cannot be booked together. '
                'Book them in separate checkouts.'
            ),
        })


def org_capacity(org) -> int:
    return max(1, int(getattr(org, 'concurrent_capacity', 1) or 1))


def _occupying_bookings_in_window(org, start_at, end_at):
    return list(
        Booking.objects.filter(
            organization=org,
            start_at__lt=end_at,
            end_at__gt=start_at,
        )
        .exclude(status__in=OCCUPYING_EXCLUDE)
        .only('id', 'start_at', 'end_at')
        .order_by('start_at')
    )


def window_remaining_capacity(org, start_at, end_at) -> int:
    """
    Seats left for a new visit spanning [start_at, end_at).
    Uses max concurrent overlapping bookings vs org concurrent_capacity.
    """
    capacity = org_capacity(org)
    bookings = _occupying_bookings_in_window(org, start_at, end_at)
    if not bookings:
        return capacity

    events = []
    for b in bookings:
        events.append((b.start_at, 1))
        events.append((b.end_at, -1))
    events.sort(key=lambda e: (e[0], e[1]))

    active = 0
    peak = 0
    for _, delta in events:
        active += delta
        if active > peak:
            peak = active
    return max(0, capacity - peak)


def window_has_unavailable(org, start_at, end_at) -> bool:
    return UnavailableBlock.objects.filter(
        organization=org,
        start_at__lt=end_at,
        end_at__gt=start_at,
    ).exists()


def _merge_intervals(intervals):
    if not intervals:
        return []
    ordered = sorted(intervals, key=lambda x: x[0])
    merged = [list(ordered[0])]
    for start, end in ordered[1:]:
        if start <= merged[-1][1]:
            if end > merged[-1][1]:
                merged[-1][1] = end
        else:
            merged.append([start, end])
    return [(a, b) for a, b in merged]


def open_slot_coverage(org, start_at, end_at, *, service_ids=None):
    """Merged intervals of bookable open slots that can cover a combined visit."""
    qs = (
        AvailabilitySlot.objects.filter(
            organization=org,
            start_at__lt=end_at,
            end_at__gt=start_at,
        )
        .select_related('organization')
        .prefetch_related('bookings')
    )
    if service_ids is not None:
        qs = qs.filter(Q(service_id__in=service_ids) | Q(service__isnull=True))

    intervals = []
    for slot in qs:
        if not slot.is_bookable():
            continue
        intervals.append((slot.start_at, slot.end_at))
    return _merge_intervals(intervals)


def window_covered_by_open_slots(org, start_at, end_at, *, service_ids=None) -> bool:
    merged = open_slot_coverage(org, start_at, end_at, service_ids=service_ids)
    cursor = start_at
    for cov_start, cov_end in merged:
        if cov_end <= cursor:
            continue
        if cov_start > cursor:
            return False
        cursor = cov_end
        if cursor >= end_at:
            return True
    return cursor >= end_at


def is_combined_window_bookable(org, start_at, end_at, *, service_ids=None, now=None) -> bool:
    if start_at >= end_at:
        return False
    if not is_slot_start_bookable_for_customer(start_at, now=now):
        return False
    if window_has_unavailable(org, start_at, end_at):
        return False
    if window_remaining_capacity(org, start_at, end_at) < 1:
        return False
    return window_covered_by_open_slots(org, start_at, end_at, service_ids=service_ids)


def candidate_combined_starts(org, services, *, range_start, range_end, now=None):
    """
    Start times where a contiguous free window of sum(durations) fits under open-slot coverage.
    """
    if not services:
        return []
    assert_same_fulfillment(services)
    total = total_duration_minutes(services)
    service_ids = [s.id for s in services]
    bookable_after = earliest_customer_bookable_at(now=now)
    duration = timedelta(minutes=total)

    slots = (
        AvailabilitySlot.objects.filter(
            Q(service_id__in=service_ids) | Q(service__isnull=True),
            organization=org,
            start_at__gte=range_start,
            start_at__lte=range_end,
        )
        .select_related('organization')
        .prefetch_related('bookings')
        .order_by('start_at')
    )

    starts = []
    seen = set()
    for slot in slots:
        if not slot.is_bookable():
            continue
        start = slot.start_at
        if start in seen:
            continue
        seen.add(start)
        if start < bookable_after:
            continue
        end = start + duration
        if not is_combined_window_bookable(
            org, start, end, service_ids=service_ids, now=now,
        ):
            continue
        remaining = window_remaining_capacity(org, start, end)
        starts.append({
            'start_at': start,
            'end_at': end,
            'duration_minutes': total,
            'capacity': org_capacity(org),
            'remaining_capacity': remaining,
            'available': remaining > 0,
            'anchor_slot_id': slot.id,
        })
    return starts


def _find_or_create_segment_slot(org, service, start_at, end_at):
    # Prefer exact service match, then any-service open slot, else create.
    exact = (
        AvailabilitySlot.objects.select_for_update()
        .filter(
            organization=org,
            service=service,
            start_at=start_at,
            end_at=end_at,
        )
        .first()
    )
    if exact and exact.is_bookable():
        return exact

    any_slot = (
        AvailabilitySlot.objects.select_for_update()
        .filter(
            organization=org,
            service__isnull=True,
            start_at=start_at,
            end_at=end_at,
        )
        .first()
    )
    if any_slot and any_slot.is_bookable():
        return any_slot

    return AvailabilitySlot.objects.create(
        organization=org,
        service=service,
        start_at=start_at,
        end_at=end_at,
        status=AvailabilitySlot.Status.OPEN,
    )


def _claim_empty_overlapping_slots(org, start_at, end_at, *, keep_slot_ids):
    """
    When capacity is 1, remove other empty open slots that overlap the visit so
    other service calendars cannot double-book the same time.
    """
    if org_capacity(org) > 1:
        return
    open_qs = AvailabilitySlot.objects.filter(
        organization=org,
        status=AvailabilitySlot.Status.OPEN,
        start_at__lt=end_at,
        end_at__gt=start_at,
    ).exclude(id__in=keep_slot_ids).prefetch_related('bookings')
    empty_ids = [s.id for s in open_qs if s.occupied_count() == 0]
    if empty_ids:
        AvailabilitySlot.objects.filter(id__in=empty_ids).delete()


@transaction.atomic
def customer_request_combined_visit(
    *,
    organization,
    services,
    start_at,
    customer,
    notes='',
    service_address='',
):
    """
    Book multiple services as one contiguous visit starting at start_at.
    Creates one Booking per service with sequential times summing to total duration.
    """
    if not services:
        raise ValidationError({'services': 'Select at least one service to book.'})
    if len(services) > 10:
        raise ValidationError({'services': 'You can book at most 10 services at once.'})

    org = organization
    if isinstance(org, int):
        org = Organization.objects.get(pk=org)

    services = list(services)
    for svc in services:
        if svc.organization_id != org.id:
            raise ValidationError({'services': 'All services must belong to this business.'})
        if not svc.is_active:
            raise ValidationError({'services': f'{svc.name} is not available.'})

    assert_same_fulfillment(services)
    total = total_duration_minutes(services)
    end_at = start_at + timedelta(minutes=total)
    service_ids = [s.id for s in services]

    if not is_combined_window_bookable(org, start_at, end_at, service_ids=service_ids):
        raise ValidationError({
            'start_at': (
                'That time is not available for the combined visit. '
                'Pick a start with enough free time for all selected services.'
            ),
        })

    cursor = start_at
    bookings = []
    keep_ids = []
    for svc in services:
        seg_end = cursor + timedelta(minutes=int(svc.duration_minutes or 0))
        slot = _find_or_create_segment_slot(org, svc, cursor, seg_end)
        if not slot.is_bookable():
            raise ValidationError({
                'start_at': f'No open capacity for {svc.name} in this window.',
            })
        booking = customer_request_slot(
            slot=slot,
            customer=customer,
            service=svc,
            notes=notes or '',
            service_address=service_address or '',
        )
        bookings.append(booking)
        keep_ids.append(slot.id)
        cursor = seg_end

    _claim_empty_overlapping_slots(org, start_at, end_at, keep_slot_ids=keep_ids)
    return bookings
