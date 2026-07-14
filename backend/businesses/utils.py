from django.utils.text import slugify

from .location import parse_radius_miles
from .models import Organization


def unique_organization_slug(name: str) -> str:
    base = slugify(name) or 'business'
    slug = base
    counter = 2
    while Organization.objects.filter(slug=slug).exists():
        slug = f'{base}-{counter}'
        counter += 1
    return slug


def organization_location_short(org) -> str:
    """e.g. Austin, TX · 78701"""
    city = (org.service_city or '').strip()
    state = (org.service_state or '').strip()
    postal = (org.service_postal_code or '').strip()
    place = ''
    if city and state:
        place = f'{city}, {state}'
    else:
        place = city or state or ''
    if postal and place:
        return f'{place} · {postal}'
    return place or postal or ''


def organization_location_full(org) -> str:
    """Address plus city/state for customer-facing listings."""
    addr = (org.service_address or '').strip()
    short = organization_location_short(org)
    if addr and short:
        return f'{addr} · {short}'
    if addr:
        return addr
    return short or ''


def miles_to_km_label(miles: float) -> str:
    km = round(float(miles) * 1.609344, 1)
    km_text = int(km) if km == int(km) else km
    mi_text = int(miles) if miles == int(miles) else round(float(miles), 1)
    return f'{mi_text} mi ({km_text} km)'


def organization_service_area_label(org) -> str:
    """Marketplace-style service coverage label."""
    radius = parse_radius_miles(getattr(org, 'service_radius_miles', None) or 25)
    radius_label = miles_to_km_label(radius)
    short = organization_location_short(org) or (org.service_address or '').strip()
    if short:
        return f'Serves within {radius_label} of {short}'
    return f'Serves within {radius_label} of your map pin'
