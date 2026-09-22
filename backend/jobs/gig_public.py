"""Public Gig Wall helpers: contact blocking, sanitization, SEO URLs."""

from __future__ import annotations

import re
from typing import Any

from django.conf import settings
from django.utils.text import slugify

CONTACT_INFO_ERROR = (
    'Remove phone numbers and email addresses. '
    'Providers will contact you privately after you accept a quote.'
)

CONTACT_HINT = "Don't share phone or email here — providers ask privately."

# Simple email (case-insensitive).
_EMAIL_RE = re.compile(
    r'(?i)\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b',
)

# North American phones: require area code (formatted) or compact 10/11 digits.
# Avoid matching year ranges like 2024-2025.
_PHONE_RE = re.compile(
    r'(?<!\d)'
    r'(?:'
    r'(?:\+?1[\s\-.]*)?(?:\(?\d{3}\)?[\s\-.]*)\d{3}[\s\-.]?\d{4}'
    r'|'
    r'(?:\+?1)?\d{10,11}'
    r')'
    r'(?!\d)',
)

_CONTACT_PLACEHOLDER = '[Contact info hidden]'

_LAUNCH_CITIES = {
    'ottawa': 'Ottawa',
    'toronto': 'Toronto',
}

# City name (lower) -> slug
_CITY_NAME_TO_SLUG = {name.lower(): slug for slug, name in _LAUNCH_CITIES.items()}


def text_contains_contact_info(text: str | None) -> bool:
    """Return True if text appears to contain an email or phone number."""
    if not text:
        return False
    s = str(text)
    if _EMAIL_RE.search(s):
        return True
    if _PHONE_RE.search(s):
        return True
    return False


def assert_no_contact_info(text: str | None) -> str:
    """Raise ValueError with CONTACT_INFO_ERROR if contact info is present."""
    cleaned = (text or '').strip()
    if text_contains_contact_info(cleaned):
        raise ValueError(CONTACT_INFO_ERROR)
    return cleaned


def scrub_contact_info(text: str | None) -> str:
    """Replace emails/phones with a placeholder (legacy public SEO pages)."""
    if not text:
        return ''
    out = _EMAIL_RE.sub(_CONTACT_PLACEHOLDER, str(text))
    out = _PHONE_RE.sub(_CONTACT_PLACEHOLDER, out)
    return out


def mask_customer_name(full_name: str | None) -> str:
    """Mask to 'First LastInitial.' or a generic label."""
    name = (full_name or '').strip()
    if not name:
        return 'A Luminexa customer'
    parts = name.split()
    if len(parts) == 1:
        return parts[0]
    first = parts[0]
    last_initial = parts[-1][0].upper()
    return f'{first} {last_initial}.'


def public_area_label(*, city: str = '', postal_code: str = '') -> str:
    """FSA + city, never a street address."""
    city_clean = (city or '').strip()
    postal = re.sub(r'\s+', '', (postal_code or '').strip()).upper()
    fsa = postal[:3] if len(postal) >= 3 else ''
    if fsa and city_clean:
        return f'{fsa} area, {city_clean}'
    if fsa:
        return f'{fsa} area'
    if city_clean:
        return city_clean
    return 'your area'


def slugify_gig_title(title: str | None) -> str:
    slug = slugify(title or '')[:80].strip('-')
    return slug or 'gig'


def city_slug_for_gig(gig) -> str:
    """Map gig location to a launch-city URL slug (ottawa|toronto)."""
    city = (getattr(gig, 'location_city', None) or '').strip().lower()
    if city in _CITY_NAME_TO_SLUG:
        return _CITY_NAME_TO_SLUG[city]
    # Heuristic from Canadian FSA first letter (K≈Ottawa region, M/L≈GTA).
    postal = re.sub(r'\s+', '', (getattr(gig, 'location_postal_code', None) or '')).upper()
    if postal:
        first = postal[0]
        if first == 'K':
            return 'ottawa'
        if first in ('M', 'L'):
            return 'toronto'
    return 'ottawa'


def category_slug_for_gig(gig) -> str:
    cat = getattr(gig, 'category', None)
    if cat is not None and getattr(cat, 'slug', None):
        return cat.slug
    return 'uncategorized'


def public_gig_path(gig) -> str:
    city = city_slug_for_gig(gig)
    category = category_slug_for_gig(gig)
    title_slug = slugify_gig_title(gig.title)
    return f'/{city}/gigs/{category}/{title_slug}-{gig.id}/'


def public_gig_absolute_url(gig) -> str:
    base = getattr(settings, 'PUBLIC_APP_URL', 'http://localhost:3000').rstrip('/')
    return f'{base}{public_gig_path(gig)}'


def parse_gig_slug_id(slug_id: str) -> int | None:
    """Extract trailing integer id from '{title-slug}-{id}'."""
    if not slug_id:
        return None
    m = re.search(r'-(\d+)$', slug_id)
    if not m:
        # Allow bare numeric id
        if slug_id.isdigit():
            return int(slug_id)
        return None
    return int(m.group(1))


def is_open_for_bids(status: str) -> bool:
    return status in ('open', 'quoted')


def sanitize_gig_for_public(gig) -> dict[str, Any]:
    """Privacy-safe payload for public API / HTML / JSON-LD."""
    area = public_area_label(
        city=gig.location_city or '',
        postal_code=gig.location_postal_code or '',
    )
    title = (gig.title or '').strip()
    description = scrub_contact_info(gig.description or '')
    city_slug = city_slug_for_gig(gig)
    category = category_slug_for_gig(gig)
    path = public_gig_path(gig)
    customer_name = ''
    if getattr(gig, 'customer_id', None) and getattr(gig, 'customer', None):
        customer_name = mask_customer_name(gig.customer.full_name)
    else:
        customer_name = 'A Luminexa customer'

    return {
        'id': gig.id,
        'title': title,
        'description': description,
        'status': gig.status,
        'accepting_bids': is_open_for_bids(gig.status),
        'area_label': area,
        'city': (gig.location_city or '').strip(),
        'city_slug': city_slug,
        'category_slug': category,
        'category_name': (
            gig.category.name if getattr(gig, 'category', None) else 'Local help'
        ),
        'customer_name': customer_name,
        'path': path,
        'canonical_url': public_gig_absolute_url(gig),
        'created_at': gig.created_at.isoformat() if gig.created_at else None,
        'updated_at': gig.updated_at.isoformat() if gig.updated_at else None,
    }


def city_landing_urls() -> list[dict[str, str]]:
    """Static city SEO URLs for the dynamic sitemap (mirrors public/sitemap.xml)."""
    base = getattr(settings, 'PUBLIC_APP_URL', 'https://app.luminex-a.com').rstrip('/')
    categories = [
        'snow-removal',
        'car-detailing',
        'gardening',
        'home-cleaning',
        'yard-outdoors',
        'auto-vehicles',
        'handyman-repairs',
        'plumbing',
        'electrical',
        'painting',
        'moving-help',
        'pet-care',
        'personal-beauty',
    ]
    featured = {'snow-removal', 'car-detailing', 'gardening'}
    urls: list[dict[str, str]] = [
        {'loc': f'{base}/', 'changefreq': 'weekly', 'priority': '1.0'},
    ]
    for city_slug in ('ottawa', 'toronto'):
        urls.append({
            'loc': f'{base}/{city_slug}/',
            'changefreq': 'weekly',
            'priority': '0.9',
        })
        for cat in categories:
            priority = '0.85' if cat in featured else '0.8'
            urls.append({
                'loc': f'{base}/{city_slug}/{cat}/',
                'changefreq': 'weekly',
                'priority': priority,
            })
    urls.append({
        'loc': f'{base}/privacy',
        'changefreq': 'yearly',
        'priority': '0.2',
    })
    return urls
