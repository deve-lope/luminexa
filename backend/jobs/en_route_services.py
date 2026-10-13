"""Optional provider “I’m on my way” distance sharing (app-only, km)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from businesses.geocode import geocode_freeform_address
from businesses.location import haversine_km, quantize_coordinate
from businesses.models import OrganizationMembership

from .booking_services import _require_job_action_window
from .models import Booking

EN_ROUTE_NEARBY_KM = 5.0
EN_ROUTE_LOCATION_MIN_INTERVAL = timedelta(seconds=240)  # ~4 min server throttle


def booking_is_en_route(booking) -> bool:
    return bool(getattr(booking, 'en_route_at', None))


def _require_staff(booking, staff_user):
    if not OrganizationMembership.objects.filter(
        organization=booking.organization,
        user=staff_user,
        role__in=(
            OrganizationMembership.Role.OWNER,
            OrganizationMembership.Role.STAFF,
        ),
    ).exists():
        raise PermissionDenied('Only staff can share on-the-way location.')


def _en_route_clear_fields():
    return {
        'en_route_at': None,
        'en_route_lat': None,
        'en_route_lng': None,
        'en_route_updated_at': None,
        'en_route_distance_km': None,
        'en_route_nearby_notified_at': None,
    }


def clear_en_route(booking, *, save: bool = True) -> Booking:
    """Stop sharing without auditing (used when job starts / ends)."""
    if not booking_is_en_route(booking) and booking.en_route_lat is None:
        return booking
    for key, value in _en_route_clear_fields().items():
        setattr(booking, key, value)
    if save:
        booking.save(
            update_fields=[
                *(_en_route_clear_fields().keys()),
                'updated_at',
            ]
        )
    return booking


def ensure_booking_service_coordinates(booking) -> bool:
    """Geocode service_address once; return True if lat/lng are available."""
    if booking.service_latitude is not None and booking.service_longitude is not None:
        return True
    address = (booking.service_address or '').strip()
    if not address:
        return False
    from .service_address import geocode_query_variants

    coords = None
    for query in geocode_query_variants(address):
        coords = geocode_freeform_address(query)
        if coords:
            break
    if not coords:
        return False
    lat, lng = coords
    booking.service_latitude = quantize_coordinate(lat)
    booking.service_longitude = quantize_coordinate(lng)
    booking.save(update_fields=['service_latitude', 'service_longitude', 'updated_at'])
    return True


def _parse_coords(lat, lng):
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (TypeError, ValueError):
        raise ValidationError({'lat': 'Valid lat and lng are required.'})
    if not (-90 <= lat_f <= 90) or not (-180 <= lng_f <= 180):
        raise ValidationError({'lat': 'Coordinates out of range.'})
    return lat_f, lng_f


def _compute_distance_km(booking, lat: float, lng: float) -> Decimal | None:
    if booking.service_latitude is None or booking.service_longitude is None:
        return None
    km = haversine_km(
        lat,
        lng,
        float(booking.service_latitude),
        float(booking.service_longitude),
    )
    return Decimal(str(round(km, 2)))


@transaction.atomic
def start_en_route(booking, *, staff_user, lat=None, lng=None) -> tuple[Booking, bool]:
    """Start sharing. Returns (booking, nearby_just_crossed)."""
    if booking.status != Booking.Status.CONFIRMED:
        raise ValidationError({'status': 'Only confirmed bookings can use on-my-way.'})
    _require_job_action_window(booking)
    _require_staff(booking, staff_user)
    if not (booking.service_address or '').strip() and (
        booking.service_latitude is None or booking.service_longitude is None
    ):
        raise ValidationError({
            'service_address': 'A job address is required before sharing location.',
        })
    if not ensure_booking_service_coordinates(booking):
        raise ValidationError({
            'service_address': (
                'Could not locate this job address. Ask the customer to update it, '
                'or start the job without sharing location.'
            ),
        })

    now = timezone.now()
    booking.en_route_at = now
    booking.en_route_nearby_notified_at = None
    nearby_just_crossed = False
    update_fields = ['en_route_at', 'en_route_nearby_notified_at', 'updated_at']

    if lat is not None and lng is not None:
        lat_f, lng_f = _parse_coords(lat, lng)
        booking.en_route_lat = quantize_coordinate(lat_f)
        booking.en_route_lng = quantize_coordinate(lng_f)
        booking.en_route_updated_at = now
        booking.en_route_distance_km = _compute_distance_km(booking, lat_f, lng_f)
        update_fields.extend([
            'en_route_lat', 'en_route_lng', 'en_route_updated_at', 'en_route_distance_km',
        ])
        if (
            booking.en_route_distance_km is not None
            and float(booking.en_route_distance_km) <= EN_ROUTE_NEARBY_KM
        ):
            booking.en_route_nearby_notified_at = now
            nearby_just_crossed = True

    booking.save(update_fields=update_fields)
    return booking, nearby_just_crossed


@transaction.atomic
def stop_en_route(booking, *, staff_user) -> Booking:
    _require_staff(booking, staff_user)
    if not booking_is_en_route(booking):
        raise ValidationError({'status': 'Location sharing is not active.'})
    return clear_en_route(booking, save=True)


@transaction.atomic
def update_en_route_location(booking, *, staff_user, lat, lng) -> tuple[Booking, bool]:
    """
    Update provider GPS while en route.

    Returns (booking, nearby_just_crossed) where nearby_just_crossed is True
    the first time distance drops to ≤ EN_ROUTE_NEARBY_KM.
    """
    _require_staff(booking, staff_user)
    if not booking_is_en_route(booking):
        raise ValidationError({'status': 'Start “I’m on my way” before sending location.'})
    if booking.status != Booking.Status.CONFIRMED:
        raise ValidationError({'status': 'Location sharing only applies to confirmed bookings.'})

    now = timezone.now()
    if (
        booking.en_route_updated_at
        and (now - booking.en_route_updated_at) < EN_ROUTE_LOCATION_MIN_INTERVAL
    ):
        raise ValidationError({
            'detail': 'Location updates are limited to about every 5 minutes.',
        })

    lat_f, lng_f = _parse_coords(lat, lng)
    if not ensure_booking_service_coordinates(booking):
        raise ValidationError({
            'service_address': 'Could not locate this job address for distance updates.',
        })

    distance = _compute_distance_km(booking, lat_f, lng_f)
    booking.en_route_lat = quantize_coordinate(lat_f)
    booking.en_route_lng = quantize_coordinate(lng_f)
    booking.en_route_updated_at = now
    booking.en_route_distance_km = distance

    nearby_just_crossed = False
    if (
        distance is not None
        and float(distance) <= EN_ROUTE_NEARBY_KM
        and booking.en_route_nearby_notified_at is None
    ):
        booking.en_route_nearby_notified_at = now
        nearby_just_crossed = True

    booking.save(
        update_fields=[
            'en_route_lat',
            'en_route_lng',
            'en_route_updated_at',
            'en_route_distance_km',
            'en_route_nearby_notified_at',
            'updated_at',
        ]
    )
    return booking, nearby_just_crossed
