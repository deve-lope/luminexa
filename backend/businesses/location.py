"""Distance helpers, organization coordinate assignment, and multi-location sync."""

from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Q

from .geocode import resolve_coordinates
from .models import Organization, OrganizationLocation

COORDINATE_QUANTUM = Decimal('0.000001')


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in miles."""
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def parse_radius_miles(value) -> float:
    try:
        miles = float(value)
    except (TypeError, ValueError):
        miles = 25.0
    return max(1.0, min(100.0, miles))


def quantize_coordinate(value):
    """Round lat/lng to 6 decimal places for DecimalField storage."""
    if value is None or value == '':
        return None
    return Decimal(str(value)).quantize(COORDINATE_QUANTUM, rounding=ROUND_HALF_UP)


def assign_org_coordinates(org: Organization, *, save: bool = True) -> bool:
    """Geocode organization primary service location and store lat/lng."""
    postal = (org.service_postal_code or '').strip()
    if len(postal) < 3:
        return False
    coords = resolve_coordinates(
        postal,
        city=org.service_city or '',
        state=org.service_state or '',
    )
    if not coords:
        return False
    lat, lng = coords
    org.service_latitude = quantize_coordinate(lat)
    org.service_longitude = quantize_coordinate(lng)
    if save:
        org.save(update_fields=['service_latitude', 'service_longitude', 'updated_at'])
    # Keep primary OrganizationLocation in sync when present.
    primary = org.locations.filter(is_primary=True).first()
    if primary:
        primary.latitude = org.service_latitude
        primary.longitude = org.service_longitude
        primary.save(update_fields=['latitude', 'longitude', 'updated_at'])
    return True


def assign_location_coordinates(location: OrganizationLocation, *, save: bool = True) -> bool:
    """Geocode a single OrganizationLocation from its postal/city/state."""
    postal = (location.postal_code or '').strip()
    if len(postal) < 3:
        return False
    coords = resolve_coordinates(
        postal,
        city=location.city or '',
        state=location.state or '',
    )
    if not coords:
        return False
    lat, lng = coords
    location.latitude = quantize_coordinate(lat)
    location.longitude = quantize_coordinate(lng)
    if save:
        location.save(update_fields=['latitude', 'longitude', 'updated_at'])
    return True


def sync_org_primary_from_location(location: OrganizationLocation, *, save: bool = True) -> None:
    """Copy a primary location onto Organization.service_* for backward compatibility."""
    if not location.is_primary:
        return
    org = location.organization
    org.service_address = location.address or ''
    org.service_city = location.city or ''
    org.service_state = location.state or ''
    org.service_postal_code = location.postal_code or ''
    org.service_latitude = location.latitude
    org.service_longitude = location.longitude
    org.service_radius_miles = location.radius_miles or 25
    if save:
        org.save(update_fields=[
            'service_address', 'service_city', 'service_state', 'service_postal_code',
            'service_latitude', 'service_longitude', 'service_radius_miles', 'updated_at',
        ])


def ensure_primary_location(org: Organization) -> OrganizationLocation | None:
    """
    Ensure the org has a primary location row.
    Creates one from Organization.service_* if needed.
    """
    existing = org.locations.filter(is_primary=True).first()
    if existing:
        return existing
    any_loc = org.locations.order_by('id').first()
    if any_loc:
        any_loc.is_primary = True
        any_loc.save(update_fields=['is_primary', 'updated_at'])
        sync_org_primary_from_location(any_loc)
        return any_loc

    has_data = any([
        (org.service_address or '').strip(),
        (org.service_city or '').strip(),
        (org.service_postal_code or '').strip(),
        org.service_latitude is not None,
        org.service_longitude is not None,
    ])
    if not has_data:
        return None

    loc = OrganizationLocation.objects.create(
        organization=org,
        name='Primary',
        is_primary=True,
        address=org.service_address or '',
        city=org.service_city or '',
        state=org.service_state or '',
        postal_code=org.service_postal_code or '',
        latitude=org.service_latitude,
        longitude=org.service_longitude,
        radius_miles=org.service_radius_miles or 25,
        is_active=True,
        sort_order=0,
    )
    return loc


def set_primary_location(org: Organization, location: OrganizationLocation) -> OrganizationLocation:
    """Mark one location primary and demote others; sync org.service_*."""
    if location.organization_id != org.id:
        raise ValueError('Location does not belong to this organization.')
    org.locations.exclude(pk=location.pk).filter(is_primary=True).update(is_primary=False)
    if not location.is_primary:
        location.is_primary = True
        location.save(update_fields=['is_primary', 'updated_at'])
    sync_org_primary_from_location(location)
    return location


def organization_distances_within_radius(
    center_lat: float,
    center_lng: float,
    radius_miles: float,
    *,
    base_qs=None,
    search_postal: str = '',
) -> dict[int, float]:
    """
    Map organization id -> nearest matching location distance (miles).

    A provider location matches only when BOTH are true:
    1. distance <= customer search radius (``radius_miles``)
    2. distance <= that location's provider service radius (``radius_miles`` on the location)

    Example: customer searches 25 mi, provider serves 10 mi, distance is 15 mi → hidden.
    Ungeocoded postal prefix matches count as distance 0 (same ZIP area).
    Falls back to legacy Organization.service_* when no location rows exist.
    """
    from .postal import normalize_postal_code

    qs = base_qs if base_qs is not None else Organization.objects.all()
    org_ids = list(qs.values_list('id', flat=True))
    if not org_ids:
        return {}

    out: dict[int, float] = {}
    postal = normalize_postal_code(search_postal or '')
    customer_radius = parse_radius_miles(radius_miles)

    locations = OrganizationLocation.objects.filter(
        organization_id__in=org_ids,
        is_active=True,
    ).only(
        'id', 'organization_id', 'latitude', 'longitude', 'postal_code', 'radius_miles',
    )

    orgs_with_locations: set[int] = set()
    for loc in locations:
        orgs_with_locations.add(loc.organization_id)
        provider_radius = parse_radius_miles(loc.radius_miles or 25)
        if loc.latitude is not None and loc.longitude is not None:
            dist = haversine_miles(
                center_lat, center_lng,
                float(loc.latitude), float(loc.longitude),
            )
            # Customer must be inside their search circle AND the provider's service area.
            if dist <= customer_radius and dist <= provider_radius:
                prev = out.get(loc.organization_id)
                rounded = round(dist, 1)
                if prev is None or rounded < prev:
                    out[loc.organization_id] = rounded
        elif postal and len(postal) >= 3:
            loc_postal = normalize_postal_code(loc.postal_code or '')
            # Same-postal ungeocoded match ≈ 0 miles — always inside both radii.
            if loc_postal.startswith(postal):
                out.setdefault(loc.organization_id, 0.0)

    # Legacy fallback: orgs that still only have Organization.service_* (no location rows).
    legacy_ids = [oid for oid in org_ids if oid not in orgs_with_locations]
    if legacy_ids:
        legacy_qs = Organization.objects.filter(id__in=legacy_ids).only(
            'id', 'service_latitude', 'service_longitude',
            'service_postal_code', 'service_radius_miles',
        )
        for org in legacy_qs:
            provider_radius = parse_radius_miles(org.service_radius_miles or 25)
            if org.service_latitude is not None and org.service_longitude is not None:
                dist = haversine_miles(
                    center_lat, center_lng,
                    float(org.service_latitude), float(org.service_longitude),
                )
                if dist <= customer_radius and dist <= provider_radius:
                    out[org.id] = round(dist, 1)
            elif postal and len(postal) >= 3:
                org_postal = normalize_postal_code(org.service_postal_code or '')
                if org_postal.startswith(postal):
                    out.setdefault(org.id, 0.0)

    # Ungeocoded location postals for orgs that already have other locations.
    if postal and len(postal) >= 3:
        extra = OrganizationLocation.objects.filter(
            organization_id__in=org_ids,
            is_active=True,
            latitude__isnull=True,
            postal_code__istartswith=postal,
        ).values_list('organization_id', flat=True)
        for oid in extra:
            out.setdefault(oid, 0.0)

    return out


def nearest_location_for_org(
    org: Organization,
    center_lat: float,
    center_lng: float,
) -> tuple[OrganizationLocation | None, float | None]:
    """Return the nearest active geocoded location and its distance."""
    best = None
    best_dist = None
    for loc in org.locations.filter(is_active=True).exclude(
        Q(latitude__isnull=True) | Q(longitude__isnull=True),
    ):
        dist = haversine_miles(
            center_lat, center_lng, float(loc.latitude), float(loc.longitude),
        )
        if best_dist is None or dist < best_dist:
            best = loc
            best_dist = dist
    return best, round(best_dist, 1) if best_dist is not None else None
