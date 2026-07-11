"""Detect and normalize address country for geocoding filters (Americas only)."""

from __future__ import annotations

import json
import re
from urllib.error import URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache

_USER_AGENT = getattr(
    settings,
    'GEOCODE_USER_AGENT',
    'Luminexa/1.0 (local service marketplace)',
)

# ISO 3166-1 alpha-2 → canonical country name (Americas sovereign states).
ISO_TO_COUNTRY: dict[str, str] = {
    'CA': 'Canada',
    'US': 'United States',
    'MX': 'Mexico',
    'BZ': 'Belize',
    'CR': 'Costa Rica',
    'SV': 'El Salvador',
    'GT': 'Guatemala',
    'HN': 'Honduras',
    'NI': 'Nicaragua',
    'PA': 'Panama',
    'AG': 'Antigua and Barbuda',
    'BS': 'Bahamas',
    'BB': 'Barbados',
    'CU': 'Cuba',
    'DM': 'Dominica',
    'DO': 'Dominican Republic',
    'GD': 'Grenada',
    'HT': 'Haiti',
    'JM': 'Jamaica',
    'KN': 'Saint Kitts and Nevis',
    'LC': 'Saint Lucia',
    'VC': 'Saint Vincent and the Grenadines',
    'TT': 'Trinidad and Tobago',
    'AR': 'Argentina',
    'BO': 'Bolivia',
    'BR': 'Brazil',
    'CL': 'Chile',
    'CO': 'Colombia',
    'EC': 'Ecuador',
    'GY': 'Guyana',
    'PY': 'Paraguay',
    'PE': 'Peru',
    'SR': 'Suriname',
    'UY': 'Uruguay',
    'VE': 'Venezuela',
}

COUNTRY_TO_ISO: dict[str, str] = {v.lower(): k.lower() for k, v in ISO_TO_COUNTRY.items()}
COUNTRY_TO_ISO.update({
    'usa': 'us',
    'us': 'us',
    'united states of america': 'us',
    'brasil': 'br',
    'méxico': 'mx',
})

_COUNTRY_ALIASES: dict[str, str] = {name.lower(): name for name in ISO_TO_COUNTRY.values()}
_COUNTRY_ALIASES.update({
    'usa': 'United States',
    'us': 'United States',
    'united states of america': 'United States',
    'brasil': 'Brazil',
    'méxico': 'Mexico',
})


def country_name_from_iso(code: str) -> str:
    return ISO_TO_COUNTRY.get((code or '').strip().upper(), '')


def country_to_nominatim_code(country: str) -> str:
    """Return Nominatim / Zippopotam country code (lowercase ISO) or empty string."""
    key = (country or '').strip().lower()
    if not key:
        return ''
    if key in COUNTRY_TO_ISO:
        return COUNTRY_TO_ISO[key]
    if len(key) == 2:
        iso = key.upper()
        if iso in ISO_TO_COUNTRY:
            return key.lower()
    return ''


def is_supported_country(country: str) -> bool:
    return bool(normalize_country_name(country))


def normalize_country_name(country: str) -> str:
    key = (country or '').strip().lower()
    if not key:
        return ''
    if key in _COUNTRY_ALIASES:
        return _COUNTRY_ALIASES[key]
    if len(key) == 2:
        return country_name_from_iso(key.upper())
    for name in ISO_TO_COUNTRY.values():
        if name.lower() == key:
            return name
    return ''


def countries_match(actual: str, expected: str) -> bool:
    """True if result country matches the requested filter country.

    Unknown / non-Americas countries (e.g. France) must NOT match when a
    filter is set — previously empty normalize() incorrectly treated them as OK.
    """
    if not expected:
        return True
    e = normalize_country_name(expected).lower() or (expected or '').strip().lower()
    if not e:
        return True
    a_raw = (actual or '').strip()
    if not a_raw:
        return False
    a = normalize_country_name(a_raw).lower()
    if a:
        return a == e
    return a_raw.lower() == e


def _client_ip(request) -> str:
    """Best-effort public client IP (Cloudflare / proxies first)."""
    candidates: list[str] = [
        (request.META.get('HTTP_CF_CONNECTING_IP') or '').strip(),
        (request.META.get('HTTP_TRUE_CLIENT_IP') or '').strip(),
        (request.META.get('HTTP_X_REAL_IP') or '').strip(),
    ]
    forwarded = (request.META.get('HTTP_X_FORWARDED_FOR') or '').strip()
    if forwarded:
        candidates.extend(part.strip() for part in forwarded.split(',') if part.strip())
    candidates.append((request.META.get('REMOTE_ADDR') or '').strip())

    for ip in candidates:
        if ip and not _is_private_ip(ip):
            return ip
    for ip in candidates:
        if ip:
            return ip
    return ''


def _is_private_ip(ip: str) -> bool:
    if not ip:
        return True
    if ip in ('127.0.0.1', '::1', 'localhost'):
        return True
    if ip.startswith('10.') or ip.startswith('192.168.') or ip.startswith('169.254.'):
        return True
    if ip.startswith('172.'):
        try:
            second = int(ip.split('.')[1])
            return 16 <= second <= 31
        except (IndexError, ValueError):
            return False
    if ip.startswith('fc') or ip.startswith('fd') or ip.startswith('fe80'):
        return True
    return False


def _country_from_iso_code(code: str) -> str:
    """Map ISO code to a supported Americas country name, or '' if out of market."""
    return country_name_from_iso((code or '').strip().upper())


def _lookup_ip_country(ip: str) -> str:
    """Resolve public IP → Americas country name (cached). Empty if outside market / fail."""
    cache_key = f'lx:geoip:{ip}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    name = ''
    # Primary: GeoJS
    try:
        url = f'https://get.geojs.io/v1/ip/country/{quote(ip)}.json'
        req = Request(url, headers={'User-Agent': _USER_AGENT})
        with urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
        name = _country_from_iso_code(data.get('country') or '')
    except (URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError):
        name = ''

    # Fallback: ipwho.is when GeoJS fails or returns a non-Americas country
    if not name:
        try:
            url = f'https://ipwho.is/{quote(ip)}'
            req = Request(url, headers={'User-Agent': _USER_AGENT})
            with urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode())
            if data.get('success') is False:
                raise ValueError('ipwho failed')
            name = _country_from_iso_code(data.get('country_code') or '')
        except (URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError):
            name = ''

    cache.set(cache_key, name, timeout=3600 if name else 300)
    return name


def detect_country_from_request(request) -> tuple[str, str]:
    """
    Return (country_name, source) for Americas markets.

    Prefer physical location (Cloudflare country header, then IP geo).
    On local/private IPs, fall back to DEFAULT_ADDRESS_COUNTRY (Canada).
    source: ip_cf | ip_geo | default
    """
    cf = (request.META.get('HTTP_CF_IPCOUNTRY') or '').strip().upper()
    if cf and cf not in ('XX', 'T1'):
        name = _country_from_iso_code(cf)
        if name:
            return name, 'ip_cf'

    ip = _client_ip(request)
    if ip and not _is_private_ip(ip):
        name = _lookup_ip_country(ip)
        if name:
            return name, 'ip_geo'

    default = getattr(settings, 'DEFAULT_ADDRESS_COUNTRY', 'Canada')
    normalized = normalize_country_name(default)
    return normalized or 'Canada', 'default'


def guess_country_from_query(query: str) -> str:
    """Infer country from free-text address / postal input when possible."""
    import re

    q = (query or '').strip()
    if not q:
        return ''

    # Explicit country names in the query win.
    lowered = q.lower()
    for needle, name in (
        ('canada', 'Canada'),
        ('united states', 'United States'),
        ('usa', 'United States'),
        ('u.s.a', 'United States'),
        ('mexico', 'Mexico'),
        ('méxico', 'Mexico'),
        ('brazil', 'Brazil'),
        ('brasil', 'Brazil'),
    ):
        if re.search(rf'\b{re.escape(needle)}\b', lowered):
            return name

    # Canadian postal: A1A 1A1 or A1A1A1 (also FSA A1A)
    if re.search(r'\b[A-Za-z]\d[A-Za-z](?:\s?\d[A-Za-z]\d)?\b', q):
        return 'Canada'

    # US ZIP
    if re.search(r'\b\d{5}(?:-\d{4})?\b', q):
        return 'United States'

    # Brazilian CEP
    if re.search(r'\b\d{5}-?\d{3}\b', q) or re.search(r'\b\d{8}\b', q):
        return 'Brazil'

    ca_provinces = {
        'ontario', 'quebec', 'québec', 'british columbia', 'alberta', 'manitoba',
        'saskatchewan', 'nova scotia', 'new brunswick', 'newfoundland',
        'prince edward island', 'yukon', 'nunavut', 'northwest territories',
        ' on ', ' bc ', ' ab ', ' mb ', ' sk ', ' ns ', ' nb ', ' nl ', ' pe ', ' qc ',
    }
    padded = f' {lowered} '
    if any(p in padded or lowered.startswith(p.strip()) or lowered.endswith(p.strip()) for p in ca_provinces):
        # Avoid matching tiny tokens like "on" inside words — use word boundaries for short codes
        if re.search(
            r'\b(ON|BC|AB|MB|SK|NS|NB|NL|PE|QC|YT|NU|NT|Ontario|Quebec|Québec|'
            r'British Columbia|Alberta|Manitoba|Saskatchewan|Nova Scotia|'
            r'New Brunswick|Newfoundland|Yukon|Nunavut)\b',
            q,
            re.I,
        ):
            return 'Canada'

    us_states = {
        'california', 'texas', 'florida', 'new york', 'illinois', 'washington',
        'arizona', 'colorado', 'georgia', 'ohio', 'pennsylvania', 'michigan',
        'massachusetts', 'virginia', 'north carolina', 'new jersey', 'oregon',
        'nevada', 'minnesota', 'wisconsin', 'tennessee', 'missouri', 'maryland',
        'indiana', 'alabama', 'louisiana', 'kentucky', 'oklahoma', 'connecticut',
        'utah', 'iowa', 'arkansas', 'mississippi', 'kansas', 'new mexico',
        'nebraska', 'idaho', 'hawaii', 'alaska', 'montana', 'delaware',
        'south carolina', 'south dakota', 'north dakota', 'rhode island',
        'new hampshire', 'maine', 'vermont', 'west virginia', 'wyoming',
        'district of columbia',
    }
    if any(s in lowered for s in us_states):
        return 'United States'

    # Common US state codes (avoid 2-letter CA — that's Canada)
    if re.search(
        r'\b(AL|AK|AZ|AR|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|'
        r'MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|'
        r'UT|VA|VT|WA|WI|WV|WY)\b',
        q,
        re.I,
    ):
        return 'United States'

    return ''
