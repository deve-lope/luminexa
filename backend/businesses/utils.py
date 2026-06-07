from django.utils.text import slugify

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
