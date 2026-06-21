"""Distance helpers and organization coordinate assignment."""

from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal

from .geocode import resolve_coordinates
from .models import Organization

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
    """Geocode organization service location and store lat/lng."""
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
    return True


def organization_distances_within_radius(
    center_lat: float,
    center_lng: float,
    radius_miles: float,
    *,
    base_qs=None,
) -> dict[int, float]:
    """
    Map organization id -> distance in miles for orgs within radius.
    Only includes orgs with stored coordinates.
    """
    qs = base_qs if base_qs is not None else Organization.objects.all()
    qs = qs.filter(
        service_latitude__isnull=False,
        service_longitude__isnull=False,
    ).only('id', 'service_latitude', 'service_longitude', 'service_radius_miles')

    out: dict[int, float] = {}
    for org in qs:
        lat = float(org.service_latitude)
        lng = float(org.service_longitude)
        dist = haversine_miles(center_lat, center_lng, lat, lng)
        provider_radius = parse_radius_miles(org.service_radius_miles or 25)
        if dist <= radius_miles and dist <= provider_radius:
            out[org.id] = round(dist, 1)
    return out
