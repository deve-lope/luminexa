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
    if not expected:
        return True
    a = normalize_country_name(actual).lower()
    e = normalize_country_name(expected).lower()
    if not a or not e:
        return True
    return a == e


def _client_ip(request) -> str:
    forwarded = (request.META.get('HTTP_X_FORWARDED_FOR') or '').strip()
    if forwarded:
        return forwarded.split(',')[0].strip()
    return (request.META.get('REMOTE_ADDR') or '').strip()


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


def _lookup_ip_country(ip: str) -> str:
    cache_key = f'lx:geoip:{ip}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    url = f'https://get.geojs.io/v1/ip/country/{quote(ip)}.json'
    req = Request(url, headers={'User-Agent': _USER_AGENT})
    try:
        with urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
        code = (data.get('country') or '').strip().upper()
        name = country_name_from_iso(code)
    except (URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError):
        name = ''

    cache.set(cache_key, name, timeout=3600 if name else 300)
    return name


def _country_from_accept_language(header: str) -> str:
    for part in (header or '').split(','):
        token = part.split(';')[0].strip()
        match = re.search(r'[-_]([A-Za-z]{2})\s*$', token)
        if not match:
            continue
        name = country_name_from_iso(match.group(1).upper())
        if name:
            return name
    return ''


def detect_country_from_request(request) -> tuple[str, str]:
    """
    Return (country_name, source).
    source is one of: ip_cf, language, ip_geo, default
    """
    cf = (request.META.get('HTTP_CF_IPCOUNTRY') or '').strip().upper()
    if cf and cf not in ('XX', 'T1'):
        name = country_name_from_iso(cf)
        if name:
            return name, 'ip_cf'

    lang_country = _country_from_accept_language(request.META.get('HTTP_ACCEPT_LANGUAGE', ''))
    if lang_country:
        return lang_country, 'language'

    ip = _client_ip(request)
    if ip and not _is_private_ip(ip):
        name = _lookup_ip_country(ip)
        if name:
            return name, 'ip_geo'

    default = getattr(settings, 'DEFAULT_ADDRESS_COUNTRY', 'Canada')
    normalized = normalize_country_name(default)
    return normalized or 'Canada', 'default'
