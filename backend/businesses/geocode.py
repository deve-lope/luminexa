"""Resolve postal codes to coordinates (cached + OpenStreetMap Nominatim)."""

from __future__ import annotations

import json
import re
from urllib.error import URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from django.conf import settings

from .models import PostalGeocode
from .postal import normalize_postal_code

_USER_AGENT = getattr(
    settings,
    'GEOCODE_USER_AGENT',
    'Luminexa/1.0 (local service marketplace)',
)
_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
_NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
_ZIPPOPOTAM_URL = 'https://api.zippopotam.us'
_GEOCODER_CA_URL = 'https://geocoder.ca/'

_CA_PROVINCES = {
    'AB': 'Alberta',
    'BC': 'British Columbia',
    'MB': 'Manitoba',
    'NB': 'New Brunswick',
    'NL': 'Newfoundland and Labrador',
    'NS': 'Nova Scotia',
    'NT': 'Northwest Territories',
    'NU': 'Nunavut',
    'ON': 'Ontario',
    'PE': 'Prince Edward Island',
    'QC': 'Quebec',
    'SK': 'Saskatchewan',
    'YT': 'Yukon',
}

_CA_PROVINCE_BY_FIRST_LETTER = {
    'A': 'Newfoundland and Labrador',
    'B': 'Nova Scotia',
    'C': 'Prince Edward Island',
    'E': 'New Brunswick',
    'G': 'Quebec',
    'H': 'Quebec',
    'J': 'Quebec',
    'K': 'Ontario',
    'L': 'Ontario',
    'M': 'Ontario',
    'N': 'Ontario',
    'P': 'Ontario',
    'R': 'Manitoba',
    'S': 'Saskatchewan',
    'T': 'Alberta',
    'V': 'British Columbia',
    'X': 'Northwest Territories and Nunavut',
    'Y': 'Yukon',
}

_CA_FSA_CITY_EXACT = {
    'A1A': "St. John's",
    'B3H': 'Halifax',
    'C1A': 'Charlottetown',
    'E1A': 'Moncton',
    'G1A': 'Quebec City',
    'H2X': 'Montreal',
    'H3A': 'Montreal',
    'J8X': 'Gatineau',
    'K1A': 'Ottawa',
    'K1P': 'Ottawa',
    'M4B': 'Toronto',
    'M5V': 'Toronto',
    'R3C': 'Winnipeg',
    'S4P': 'Regina',
    'S7K': 'Saskatoon',
    'T2P': 'Calgary',
    'T3J': 'Calgary',
    'V5K': 'Vancouver',
    'V6B': 'Vancouver',
    'X1A': 'Yellowknife',
    'Y1A': 'Whitehorse',
}

_CA_FSA_CITY_PREFIX = (
    ('M', 'Toronto'),
    ('H', 'Montreal'),
    ('K1', 'Ottawa'),
    ('K2', 'Ottawa'),
    ('G1', 'Quebec City'),
    ('G2', 'Quebec City'),
    ('T2', 'Calgary'),
    ('T3', 'Calgary'),
    ('T5', 'Edmonton'),
    ('T6', 'Edmonton'),
    ('V5', 'Vancouver'),
    ('V6', 'Vancouver'),
    ('R2', 'Winnipeg'),
    ('R3', 'Winnipeg'),
    ('S4', 'Regina'),
    ('S7', 'Saskatoon'),
    ('B3', 'Halifax'),
    ('C1', 'Charlottetown'),
    ('E1', 'Moncton'),
    ('A1', "St. John's"),
    ('Y1', 'Whitehorse'),
    ('X1', 'Yellowknife'),
)


def _canada_fallback_location(postal_norm: str) -> dict | None:
    """Best-effort city/province from Canadian FSA structure."""
    if not re.match(r'^[A-Z]\d[A-Z]', postal_norm):
        return None
    fsa = postal_norm[:3]
    province = _CA_PROVINCE_BY_FIRST_LETTER.get(fsa[0], '')
    city = _CA_FSA_CITY_EXACT.get(fsa, '')
    if not city:
        for prefix, prefix_city in _CA_FSA_CITY_PREFIX:
            if fsa.startswith(prefix):
                city = prefix_city
                break
    if not province and not city:
        return None
    return {
        'postal_code': postal_norm,
        'city': city,
        'state': province,
        'country': 'Canada',
        'latitude': None,
        'longitude': None,
        'source': 'canada_fsa',
    }


def _lookup_key(postal: str, city: str, state: str, country: str) -> str:
    return '|'.join([
        normalize_postal_code(postal),
        (city or '').strip().lower(),
        (state or '').strip().upper(),
        (country or '').strip().lower(),
    ])


def guess_country(postal: str, state: str = '') -> str:
    """Rough country guess for postal-code geocoding queries."""
    st = (state or '').strip().upper()
    ca_provinces = {
        'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
    }
    if st in ca_provinces:
        return 'Canada'
    p = normalize_postal_code(postal)
    if p and re.match(r'^[A-Z]\d[A-Z]', p):
        return 'Canada'
    if p and re.match(r'^\d{6}$', p):
        return 'India'
    return 'United States'


def _build_query(postal: str, city: str, state: str, country: str) -> str:
    parts = [normalize_postal_code(postal)]
    if city:
        parts.append(city.strip())
    if state:
        parts.append(state.strip())
    parts.append(country)
    return ', '.join(p for p in parts if p)


def _postal_for_zippopotam(postal_norm: str, country: str) -> tuple[str, str] | None:
    country_name = (country or '').strip().lower()
    country_codes = {
        'canada': 'ca',
        'united states': 'us',
        'usa': 'us',
        'us': 'us',
        'india': 'in',
    }
    code = country_codes.get(country_name)
    if not code:
        return None
    postal_value = postal_norm
    if code == 'ca' and len(postal_norm) == 6:
        postal_value = f'{postal_norm[:3]} {postal_norm[3:]}'
    return code, postal_value


def _zippopotam_lookup(postal_norm: str, country: str) -> dict | None:
    target = _postal_for_zippopotam(postal_norm, country)
    if not target:
        return None
    country_code, postal_value = target
    url = f'{_ZIPPOPOTAM_URL}/{country_code}/{quote(postal_value)}'
    req = Request(url, headers={'User-Agent': _USER_AGENT})
    try:
        with urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError, IndexError):
        return None

    places = data.get('places') or []
    if not places:
        return None
    place = places[0]
    return {
        'postal_code': normalize_postal_code(data.get('post code') or postal_norm),
        'city': place.get('place name') or '',
        'state': place.get('state') or place.get('state abbreviation') or '',
        'country': data.get('country') or country,
        'latitude': float(place['latitude']),
        'longitude': float(place['longitude']),
        'source': 'zippopotam',
    }


def _geocoder_ca_lookup(postal_norm: str) -> dict | None:
    url = f'{_GEOCODER_CA_URL}?{urlencode({"postal": postal_norm, "json": 1})}'
    req = Request(url, headers={'User-Agent': _USER_AGENT})
    try:
        with urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError, IndexError):
        return None

    standard = data.get('standard') or {}
    city = standard.get('city') or ''
    prov_code = (standard.get('prov') or '').upper()
    fallback = _canada_fallback_location(postal_norm) or {}
    city = city or fallback.get('city') or ''
    province = _CA_PROVINCES.get(prov_code, prov_code) or fallback.get('state') or ''
    if not city and not province:
        return None
    latitude = data.get('latt')
    longitude = data.get('longt')
    return {
        'postal_code': normalize_postal_code(data.get('postal') or postal_norm),
        'city': city,
        'state': province,
        'country': 'Canada',
        'latitude': float(latitude) if latitude not in (None, '') else None,
        'longitude': float(longitude) if longitude not in (None, '') else None,
        'source': 'geocoder.ca',
    }


def _address_payload(result: dict) -> dict:
    address = result.get('address') or {}
    return {
        'display_name': result.get('display_name') or '',
        'latitude': float(result.get('lat')),
        'longitude': float(result.get('lon')),
        'city': (
            address.get('city')
            or address.get('town')
            or address.get('village')
            or address.get('municipality')
            or address.get('county')
            or ''
        ),
        'state': address.get('state') or address.get('province') or address.get('region') or '',
        'postal_code': normalize_postal_code(address.get('postcode') or ''),
        'country': address.get('country') or '',
    }


def _nominatim_lookup(query: str) -> dict | None:
    params = urlencode({'q': query, 'format': 'json', 'addressdetails': 1, 'limit': 1})
    url = f'{_NOMINATIM_URL}?{params}'
    req = Request(url, headers={'User-Agent': _USER_AGENT})
    try:
        with urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError, IndexError):
        return None
    if not data:
        return None
    return data[0]


def search_locations(query: str, *, limit: int = 5) -> list[dict]:
    """Return address search results from Nominatim for map selection."""
    q = (query or '').strip()
    if len(q) < 3:
        return []
    params = urlencode({
        'q': q,
        'format': 'json',
        'addressdetails': 1,
        'limit': max(1, min(limit, 8)),
    })
    url = f'{_NOMINATIM_URL}?{params}'
    req = Request(url, headers={'User-Agent': _USER_AGENT})
    try:
        with urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError, IndexError):
        return []
    results = []
    for result in data or []:
        try:
            results.append(_address_payload(result))
        except (TypeError, ValueError):
            continue
    return results


def reverse_geocode(lat: float, lng: float) -> dict | None:
    """Return an address-like payload for latitude/longitude."""
    params = urlencode({
        'lat': lat,
        'lon': lng,
        'format': 'json',
        'addressdetails': 1,
        'zoom': 18,
    })
    url = f'{_NOMINATIM_REVERSE_URL}?{params}'
    req = Request(url, headers={'User-Agent': _USER_AGENT})
    try:
        with urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError, IndexError):
        return None
    if not data or data.get('error'):
        return None
    return _address_payload(data)


def _nominatim_geocode(query: str) -> tuple[float, float] | None:
    result = _nominatim_lookup(query)
    if not result:
        return None
    return float(result['lat']), float(result['lon'])


def _location_from_nominatim_result(postal_norm: str, result: dict, country: str) -> dict:
    address = result.get('address') or {}
    city = (
        address.get('city')
        or address.get('town')
        or address.get('village')
        or address.get('municipality')
        or address.get('county')
        or ''
    )
    state = (
        address.get('state')
        or address.get('province')
        or address.get('region')
        or address.get('state_district')
        or ''
    )
    country_name = address.get('country') or country
    return {
        'postal_code': postal_norm,
        'city': city,
        'state': state,
        'country': country_name,
        'latitude': float(result['lat']),
        'longitude': float(result['lon']),
        'source': 'nominatim',
    }


def lookup_postal_location(postal: str, *, country: str = '') -> dict | None:
    """Return city/state/province details for a postal code, using the geocode cache."""
    postal_norm = normalize_postal_code(postal)
    if len(postal_norm) < 3:
        return None
    if not country:
        country = guess_country(postal_norm)
    key = _lookup_key(postal_norm, '', '', country)

    cached = PostalGeocode.objects.filter(lookup_key=key).first()
    cached_country_matches = (
        not cached
        or not country
        or not cached.country
        or cached.country.strip().lower() == country.strip().lower()
    )
    if cached and cached_country_matches and (cached.city or cached.state):
        return {
            'postal_code': cached.postal_code,
            'city': cached.city,
            'state': cached.state,
            'country': cached.country,
            'latitude': float(cached.latitude),
            'longitude': float(cached.longitude),
            'source': cached.source,
        }

    if not getattr(settings, 'GEOCODE_ENABLED', True):
        return None

    if country.strip().lower() == 'canada':
        canada_location = _geocoder_ca_lookup(postal_norm)
        if canada_location:
            if canada_location.get('latitude') is not None and canada_location.get('longitude') is not None:
                PostalGeocode.objects.update_or_create(
                    lookup_key=key,
                    defaults=canada_location,
                )
            return canada_location
        canada_location = _canada_fallback_location(postal_norm)
        if canada_location:
            return canada_location

    zip_location = _zippopotam_lookup(postal_norm, country)
    if zip_location:
        PostalGeocode.objects.update_or_create(
            lookup_key=key,
            defaults=zip_location,
        )
        return zip_location

    result = _nominatim_lookup(_build_query(postal_norm, '', '', country))
    if not result:
        result = _nominatim_lookup(postal_norm)
    if not result:
        if country.strip().lower() == 'canada':
            return _canada_fallback_location(postal_norm)
        return None

    location = _location_from_nominatim_result(postal_norm, result, country)
    if country and location.get('country'):
        expected = country.strip().lower()
        actual = location['country'].strip().lower()
        if expected and actual != expected:
            return None
    PostalGeocode.objects.update_or_create(
        lookup_key=key,
        defaults=location,
    )
    return location


def resolve_coordinates(
    postal: str,
    *,
    city: str = '',
    state: str = '',
    country: str = '',
) -> tuple[float, float] | None:
    """
    Return (latitude, longitude) for a postal / PIN search center.
    Uses DB cache, then Nominatim when enabled.
    """
    postal_norm = normalize_postal_code(postal)
    if len(postal_norm) < 3:
        return None
    if not country:
        country = guess_country(postal_norm, state)
    key = _lookup_key(postal_norm, city, state, country)
    cached = PostalGeocode.objects.filter(lookup_key=key).first()
    if cached:
        return float(cached.latitude), float(cached.longitude)

    if not getattr(settings, 'GEOCODE_ENABLED', True):
        return None

    query = _build_query(postal_norm, city, state, country)
    coords = _nominatim_geocode(query)
    if not coords:
        if city:
            coords = _nominatim_geocode(_build_query(postal_norm, '', state, country))
    if not coords:
        return None

    lat, lng = coords
    PostalGeocode.objects.update_or_create(
        lookup_key=key,
        defaults={
            'postal_code': postal_norm,
            'city': (city or '').strip(),
            'state': (state or '').strip().upper(),
            'country': country,
            'latitude': lat,
            'longitude': lng,
            'source': 'nominatim',
        },
    )
    return lat, lng
