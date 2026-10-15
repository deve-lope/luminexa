"""Snow dispatch business logic: properties, runs, complete-stop, photos."""

from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from zoneinfo import ZoneInfo

from businesses.models import Organization, OrganizationMembership

from .dispatch_optimizer import haversine_km, solo_detour_minutes, solve
from .models import (
    Booking,
    DispatchRoute,
    DispatchRun,
    DispatchRunStop,
    DispatchStopPhoto,
    Service,
    ServiceProperty,
    ServiceRegion,
)


def org_today(org: Organization):
    try:
        return timezone.now().astimezone(ZoneInfo(org.timezone or 'America/New_York')).date()
    except Exception:
        return timezone.localdate()


def depot_for_region(region: ServiceRegion) -> tuple[float, float]:
    org = region.organization
    if region.depot_latitude is not None and region.depot_longitude is not None:
        return float(region.depot_latitude), float(region.depot_longitude)
    if org.service_latitude is not None and org.service_longitude is not None:
        return float(org.service_latitude), float(org.service_longitude)
    raise ValidationError({'depot': 'Set a depot pin on the region or org service location.'})


def live_optimize_properties(org: Organization, region: ServiceRegion):
    """Seasonal/monthly properties eligible for optimize (live + expiring)."""
    today = org_today(org)
    qs = ServiceProperty.objects.filter(
        organization=org,
        region=region,
        is_active=True,
        frequency__in=(
            ServiceProperty.Frequency.SEASONAL,
            ServiceProperty.Frequency.MONTHLY,
        ),
    ).select_related('customer')
    out = []
    for p in qs:
        st = p.contract_status(today)
        if st in ('live', 'expiring'):
            out.append(p)
    return out


def geocode_property(prop: ServiceProperty) -> None:
    from businesses.geocode import geocode_freeform_address

    parts = [
        prop.service_address_line1,
        prop.service_address_line2,
        prop.service_city,
        prop.service_region,
        prop.service_postal,
        prop.service_country or 'Canada',
    ]
    address = ', '.join(p for p in parts if p)
    coords = geocode_freeform_address(address)
    if coords:
        prop.latitude = Decimal(str(round(coords[0], 6)))
        prop.longitude = Decimal(str(round(coords[1], 6)))
        prop.geocoded_at = timezone.now()
        prop.save(update_fields=['latitude', 'longitude', 'geocoded_at', 'updated_at'])


def stop_payload_from_property(prop: ServiceProperty) -> dict:
    return {
        'id': f'p{prop.id}',
        'lat': float(prop.latitude),
        'lng': float(prop.longitude),
        'service_min': prop.resolve_service_minutes(),
        'property_id': prop.id,
    }


@transaction.atomic
def optimize_run(run: DispatchRun, *, persist: bool = True) -> dict:
    org = run.organization
    region = run.region
    depot = depot_for_region(region)
    stops_qs = list(run.stops.select_related('property', 'booking'))
    missing = [s for s in stops_qs if s.latitude is None or s.longitude is None]
    if missing:
        raise ValidationError({
            'stops': f'{len(missing)} stop(s) need a map pin (Fix address).',
            'code': 'missing_coordinates',
        })
    if len(stops_qs) > 120:
        raise ValidationError({'stops': 'Maximum 120 stops per run.'})

    routes = list(run.routes.select_related('crew_membership').order_by('vehicle_index'))
    n_vehicles = max(1, len(routes))
    stop_inputs = [
        {
            'id': s.id,
            'lat': float(s.latitude),
            'lng': float(s.longitude),
            'service_min': s.service_minutes,
        }
        for s in stops_qs
    ]
    result = solve(
        depot,
        stop_inputs,
        vehicles=n_vehicles,
        speed_kmh=float(org.snow_plow_speed_kmh or 30),
        road_factor=float(org.snow_road_factor or Decimal('1.3')),
        time_limit_s=5,
    )
    if persist:
        # Clear route assignment then reassign
        run.stops.update(route=None, sequence=0, eta_at=None)
        for idx, route in enumerate(routes):
            ordered_ids = result['routes'][idx] if idx < len(result['routes']) else []
            for seq, stop_id in enumerate(ordered_ids):
                stop = next(s for s in stops_qs if s.id == stop_id)
                offset = result['arrival_offsets_min'].get(stop_id, 0)
                stop.route = route
                stop.sequence = seq
                stop.eta_at = run.scheduled_start + timedelta(minutes=float(offset))
                stop.save(update_fields=['route', 'sequence', 'eta_at'])
        run.solver_meta = {
            'solver': result['solver'],
            'solve_ms': result['solve_ms'],
            'totals': result['totals'],
        }
        run.save(update_fields=['solver_meta', 'updated_at'])
    return result


@transaction.atomic
def commit_run(run: DispatchRun) -> DispatchRun:
    if run.status != DispatchRun.Status.DRAFT:
        raise ValidationError({'status': 'Only draft runs can be committed.'})
    if not run.routes.exists():
        raise ValidationError({'crews': 'Assign at least one crew before commit.'})
    if not run.stops.exists():
        raise ValidationError({'stops': 'Add stops before commit.'})
    optimize_run(run, persist=True)
    # Freeze address snapshots
    for stop in run.stops.select_related('property'):
        prop = stop.property
        if prop:
            stop.address_line1 = prop.service_address_line1
            stop.address_line2 = prop.service_address_line2
            stop.city = prop.service_city
            stop.region = prop.service_region
            stop.postal = prop.service_postal
            stop.country = prop.service_country or 'CA'
            stop.latitude = prop.latitude
            stop.longitude = prop.longitude
            stop.notes = prop.notes
            stop.work_type = prop.work_type
            stop.house_type = prop.house_type
            stop.service_minutes = prop.resolve_service_minutes()
            stop.save()
    run.status = DispatchRun.Status.SCHEDULED
    run.committed_at = timezone.now()
    run.save(update_fields=['status', 'committed_at', 'updated_at'])
    from .dispatch_notifications import notify_run_committed

    notify_run_committed(run)
    return run


def shift_route_etas(route: DispatchRoute, delay_minutes: float) -> None:
    if abs(delay_minutes) < 0.5:
        return
    pending = route.stops.filter(status=DispatchRunStop.Status.PENDING).exclude(eta_at=None)
    for stop in pending:
        stop.eta_at = stop.eta_at + timedelta(minutes=delay_minutes)
        stop.save(update_fields=['eta_at'])


@transaction.atomic
def start_route(route: DispatchRoute, *, crew_user) -> DispatchRoute:
    m = route.crew_membership
    if m.user_id != crew_user.id:
        raise ValidationError({'detail': 'Not your route.'})
    run = route.run
    if run.status == DispatchRun.Status.CANCELLED:
        raise ValidationError({'status': 'Run was cancelled.'})
    if route.status == DispatchRoute.Status.DONE:
        raise ValidationError({'status': 'Route already finished.'})
    now = timezone.now()
    route.status = DispatchRoute.Status.IN_PROGRESS
    route.started_at = route.started_at or now
    route.save(update_fields=['status', 'started_at'])
    if run.status == DispatchRun.Status.SCHEDULED:
        run.status = DispatchRun.Status.IN_PROGRESS
        run.save(update_fields=['status', 'updated_at'])
    return route


@transaction.atomic
def complete_stop(stop: DispatchRunStop, *, crew_user) -> DispatchRunStop:
    route = stop.route
    if not route or route.crew_membership.user_id != crew_user.id:
        raise ValidationError({'detail': 'Not your stop.'})
    if stop.status != DispatchRunStop.Status.PENDING:
        raise ValidationError({'status': 'Stop is not pending.'})
    now = timezone.now()
    planned = stop.eta_at
    delay = 0.0
    if planned:
        delay = (now - planned).total_seconds() / 60.0
    stop.status = DispatchRunStop.Status.DONE
    stop.done_at = now
    stop.done_by = crew_user
    stop.save(update_fields=['status', 'done_at', 'done_by'])
    if delay:
        shift_route_etas(route, delay)

    if stop.kind == DispatchRunStop.Kind.ONE_TIME:
        _complete_one_time_stop(stop, crew_user=crew_user)
    else:
        from .dispatch_notifications import notify_stop_done_seasonal

        notify_stop_done_seasonal(stop)

    # Advance route / run
    if not route.stops.filter(status=DispatchRunStop.Status.PENDING).exists():
        route.status = DispatchRoute.Status.DONE
        route.completed_at = now
        route.save(update_fields=['status', 'completed_at'])
    run = route.run
    if not run.routes.exclude(status=DispatchRoute.Status.DONE).exists():
        run.status = DispatchRun.Status.COMPLETED
        run.save(update_fields=['status', 'updated_at'])
    return stop


def _complete_one_time_stop(stop: DispatchRunStop, *, crew_user) -> None:
    from .invoice_services import issue_or_update_invoice
    from .notifications import notify_booking_completed

    booking = stop.booking
    now = timezone.now()
    if booking:
        if booking.status not in (
            Booking.Status.COMPLETED,
            Booking.Status.CANCELLED,
        ):
            booking.status = Booking.Status.COMPLETED
            booking.save(update_fields=['status', 'updated_at'])
        issue_or_update_invoice(booking, staff_user=crew_user)
        notify_booking_completed(booking)
        return

    # Walk-in: create completed booking then invoice
    org = stop.run.organization
    service = (
        Service.objects.filter(
            organization=org,
            name__icontains=stop.work_type or 'Driveway',
            is_active=True,
        ).first()
        or Service.objects.filter(organization=org, is_active=True).first()
    )
    if not service:
        raise ValidationError({'service': 'Add a snow catalog service before invoicing one-time jobs.'})
    minutes = stop.service_minutes or 30
    address = ', '.join(
        p for p in [stop.address_line1, stop.address_line2, stop.city, stop.postal] if p
    )
    booking = Booking(
        organization=org,
        service=service,
        customer=stop.customer,
        availability_slot=None,
        status=Booking.Status.COMPLETED,
        source=Booking.Source.DISPATCH_RUN,
        start_at=now - timedelta(minutes=minutes),
        end_at=now,
        service_address=address,
        awaiting_customer_acceptance=False,
    )
    booking.save()
    stop.booking = booking
    stop.save(update_fields=['booking'])
    issue_or_update_invoice(booking, staff_user=crew_user)
    notify_booking_completed(booking)


@transaction.atomic
def skip_stop(stop: DispatchRunStop, *, crew_user, reason: str = '') -> DispatchRunStop:
    route = stop.route
    if not route or route.crew_membership.user_id != crew_user.id:
        raise ValidationError({'detail': 'Not your stop.'})
    stop.status = DispatchRunStop.Status.SKIPPED
    stop.skip_reason = (reason or '')[:200]
    stop.done_at = timezone.now()
    stop.done_by = crew_user
    stop.save(update_fields=['status', 'skip_reason', 'done_at', 'done_by'])
    if not route.stops.filter(status=DispatchRunStop.Status.PENDING).exists():
        route.status = DispatchRoute.Status.DONE
        route.completed_at = timezone.now()
        route.save(update_fields=['status', 'completed_at'])
    return stop


def save_stop_photo(stop: DispatchRunStop, *, uploaded_by, file_obj) -> DispatchStopPhoto:
    org = stop.run.organization
    if stop.photos.count() >= DispatchStopPhoto.MAX_PER_STOP:
        raise ValidationError({'photos': 'Maximum 2 photos per stop.'})
    if DispatchStopPhoto.objects.filter(organization=org).count() >= DispatchStopPhoto.ORG_QUOTA:
        raise ValidationError({
            'photos': 'Photo quota reached (200). Delete old photos to upload more.',
            'code': 'photo_quota',
        })
    data = file_obj.read()
    if len(data) > DispatchStopPhoto.MAX_BYTES:
        raise ValidationError({'photos': 'Each photo must be 2 MB or smaller.'})
    root = getattr(settings, 'PRIVATE_MEDIA_ROOT', None) or os.path.join(
        settings.BASE_DIR, 'private_media'
    )
    folder = os.path.join(root, 'dispatch_proof', str(org.id))
    os.makedirs(folder, exist_ok=True)
    name = f'{stop.id}_{uuid.uuid4().hex}.jpg'
    abs_path = os.path.join(folder, name)
    with open(abs_path, 'wb') as fh:
        fh.write(data)
    rel = os.path.join('dispatch_proof', str(org.id), name)
    return DispatchStopPhoto.objects.create(
        stop=stop,
        organization=org,
        uploaded_by=uploaded_by,
        relative_path=rel,
        size_bytes=len(data),
    )


def bookings_on_active_dispatch():
    """Bookings linked to a non-cancelled dispatch stop — exclude from appointment nudges."""
    return Booking.objects.filter(
        dispatch_stops__isnull=False,
    ).exclude(
        dispatch_stops__run__status=DispatchRun.Status.CANCELLED,
    ).distinct()


def candidates_with_detour(run: DispatchRun) -> list[dict]:
    org = run.organization
    region = run.region
    depot = depot_for_region(region)
    seasonal = [
        stop_payload_from_property(p)
        for p in live_optimize_properties(org, region)
        if p.latitude is not None and p.longitude is not None
    ]
    n_vehicles = max(1, run.routes.count() or 1)
    speed = float(org.snow_plow_speed_kmh or 30)
    factor = float(org.snow_road_factor or Decimal('1.3'))
    already = set(
        run.stops.filter(property_id__isnull=False).values_list('property_id', flat=True)
    )
    one_times = ServiceProperty.objects.filter(
        organization=org,
        region=region,
        is_active=True,
        frequency=ServiceProperty.Frequency.ONE_TIME,
    ).exclude(id__in=already)
    out = []
    for p in one_times:
        if p.latitude is None or p.longitude is None:
            out.append({
                'property_id': p.id,
                'address': p.service_address_line1,
                'solo_detour_min': None,
                'needs_geocode': True,
            })
            continue
        cand = stop_payload_from_property(p)
        detour = solo_detour_minutes(
            depot, seasonal, cand,
            vehicles=n_vehicles, speed_kmh=speed, road_factor=factor,
        )
        out.append({
            'property_id': p.id,
            'address': p.service_address_line1,
            'customer_name': getattr(p.customer, 'full_name', '') or '',
            'work_type': p.work_type,
            'house_type': p.house_type,
            'service_minutes': p.resolve_service_minutes(),
            'solo_detour_min': round(detour, 1),
            'needs_geocode': False,
        })
    return out
