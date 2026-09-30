"""Public Gig Wall helpers: contact blocking, sanitization, SEO URLs."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from django.conf import settings
from django.utils.text import slugify

CONTACT_INFO_ERROR = (
    'Remove phone numbers and email addresses. '
    'Providers will contact you privately after you accept a quote.'
)

CONTACT_HINT = "Don't share phone or email here — providers ask privately."

# Plain email (incl. fullwidth @ / dots, optional spaces around them).
_EMAIL_RE = re.compile(
    r'(?i)\b[a-z0-9._%+\-]+\s*[@＠]\s*[a-z0-9.\-]+\s*[.．]\s*[a-z]{2,}\b',
)

# Obfuscated: name (at) domain (dot) com / name[at]domain[dot]com / AT / DOT
_EMAIL_OBFUSCATED_RE = re.compile(
    r'(?i)\b[a-z0-9._%+\-]{1,64}'
    r'(?:\s*[@＠]\s*|\s*[\(\[\{]?\s*(?:at|[@＠])\s*[\)\]\}]?\s*)'
    r'[a-z0-9.\-]{1,64}'
    r'(?:\s*[.．]\s*|\s*[\(\[\{]?\s*(?:dot|[.．])\s*[\)\]\}]?\s*)'
    r'[a-z]{2,24}\b',
)

# Digit with optional separators between digits (spaces, dashes, bullets, slashes, …).
_PHONE_SEP_CLASS = r'\s\-()._/+*#·•––—,|\\\'\"~='
_PHONE_CANDIDATE_RE = re.compile(
    rf'(?:\+?\s*)?(?:\d(?:[{_PHONE_SEP_CLASS}]*\d){{9,14}})'
)

_CONTACT_PLACEHOLDER = '[Contact info hidden]'

_LAUNCH_CITIES = {
    'ottawa': 'Ottawa',
    'toronto': 'Toronto',
}

# City name (lower) -> slug
_CITY_NAME_TO_SLUG = {name.lower(): slug for slug, name in _LAUNCH_CITIES.items()}


def _normalize_for_contact_scan(text: str) -> str:
    """Map unicode digits to ASCII so ６１３… is still caught."""
    parts: list[str] = []
    for ch in text:
        if '0' <= ch <= '9':
            parts.append(ch)
            continue
        try:
            parts.append(str(unicodedata.digit(ch)))
        except (TypeError, ValueError):
            parts.append(ch)
    return ''.join(parts)


def _looks_like_na_phone(digits: str) -> bool:
    """True for 10-digit NANP (optional leading country 1)."""
    if not digits:
        return False
    if len(digits) == 11 and digits[0] == '1':
        digits = digits[1:]
    if len(digits) != 10:
        return False
    # Area code and exchange must start with 2–9 (blocks years / short ids).
    if digits[0] in '01' or digits[3] in '01':
        return False
    return True


def _iter_email_spans(text: str):
    for pattern in (_EMAIL_RE, _EMAIL_OBFUSCATED_RE):
        for m in pattern.finditer(text):
            yield m.start(), m.end()


def _iter_phone_spans(text: str):
    """Yield (start, end) spans that look like phone numbers."""
    for m in _PHONE_CANDIDATE_RE.finditer(text):
        digits = re.sub(r'\D', '', m.group())
        if _looks_like_na_phone(digits):
            yield m.start(), m.end()


def text_contains_contact_info(text: str | None) -> bool:
    """Return True if text appears to contain an email or phone number."""
    if not text:
        return False
    s = _normalize_for_contact_scan(str(text))
    if any(True for _ in _iter_email_spans(s)):
        return True
    return any(True for _ in _iter_phone_spans(s))


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
    # Scrub on the original string using spans found on the normalized view —
    # offsets match because normalization only remaps digit codepoints 1:1.
    original = str(text)
    scanned = _normalize_for_contact_scan(original)
    spans = list(_iter_email_spans(scanned)) + list(_iter_phone_spans(scanned))
    spans.sort(key=lambda t: t[0])
    # Merge overlaps then replace from the end.
    merged: list[tuple[int, int]] = []
    for start, end in spans:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    out = original
    for start, end in reversed(merged):
        out = f'{out[:start]}{_CONTACT_PLACEHOLDER}{out[end:]}'
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
    near_me_categories = {
        'snow-removal',
        'car-detailing',
        'gardening',
        'home-cleaning',
    }
    neighbourhoods = {
        'ottawa': [
            'centretown',
            'the-glebe',
            'westboro',
            'hintonburg',
            'vanier',
            'nepean',
            'kanata',
            'barrhaven',
            'orleans',
            'stittsville',
            'sandy-hill',
            'alta-vista',
        ],
        'toronto': [
            'downtown',
            'midtown',
            'the-beaches',
            'leslieville',
            'liberty-village',
            'yorkville',
            'north-york',
            'scarborough',
            'etobicoke',
            'east-york',
            'the-annex',
            'parkdale',
        ],
    }
    alternatives = ['jobber', 'odoo']
    urls: list[dict[str, str]] = [
        {'loc': f'{base}/', 'changefreq': 'weekly', 'priority': '1.0'},
        {'loc': f'{base}/alternatives/', 'changefreq': 'monthly', 'priority': '0.75'},
        {'loc': f'{base}/pricing/', 'changefreq': 'monthly', 'priority': '0.85'},
    ]
    for alt in alternatives:
        urls.append({
            'loc': f'{base}/alternatives/{alt}/',
            'changefreq': 'monthly',
            'priority': '0.8',
        })
    for city_slug in ('ottawa', 'toronto'):
        urls.append({
            'loc': f'{base}/{city_slug}/',
            'changefreq': 'weekly',
            'priority': '0.9',
        })
        urls.append({
            'loc': f'{base}/{city_slug}/near-me/',
            'changefreq': 'weekly',
            'priority': '0.88',
        })
        for cat in categories:
            priority = '0.85' if cat in featured else '0.8'
            urls.append({
                'loc': f'{base}/{city_slug}/{cat}/',
                'changefreq': 'weekly',
                'priority': priority,
            })
        for nhood in neighbourhoods[city_slug]:
            urls.append({
                'loc': f'{base}/{city_slug}/{nhood}/',
                'changefreq': 'weekly',
                'priority': '0.7',
            })
            for cat in categories:
                if cat not in near_me_categories:
                    continue
                urls.append({
                    'loc': f'{base}/{city_slug}/{nhood}/{cat}/',
                    'changefreq': 'weekly',
                    'priority': '0.65',
                })
    urls.append({
        'loc': f'{base}/privacy',
        'changefreq': 'yearly',
        'priority': '0.2',
    })
    return urls
