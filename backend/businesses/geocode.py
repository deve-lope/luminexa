"""Resolve postal codes to coordinates (cached + OpenStreetMap Nominatim)."""

from __future__ import annotations

import json
import re
from urllib.error import URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from django.conf import settings

from .country_detection import countries_match, country_to_nominatim_code
from .models import PostalGeocode
from .postal import is_canadian_postal, normalize_postal_code

_USER_AGENT = getattr(
    settings,
    'GEOCODE_USER_AGENT',
    'Luminexa/1.0 (local service marketplace)',
)
_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
_NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
_PHOTON_URL = 'https://photon.komoot.io/api/'
_PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse'
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
    if p and re.match(r'^\d{5}$', p):
        return 'United States'
    if p and re.match(r'^\d{8}$', p):
        return 'Brazil'
    return 'Canada'


def _build_query(postal: str, city: str, state: str, country: str) -> str:
    parts = [normalize_postal_code(postal)]
    if city:
        parts.append(city.strip())
    if state:
        parts.append(state.strip())
    parts.append(country)
    return ', '.join(p for p in parts if p)


def _postal_for_zippopotam(postal_norm: str, country: str) -> tuple[str, str] | None:
    code = country_to_nominatim_code(country)
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


def format_postal_display(code: str) -> str:
    norm = normalize_postal_code(code)
    if not norm:
        return ''
    if is_canadian_postal(norm) and len(norm) == 6:
        return f'{norm[:3]} {norm[3:]}'
    if norm.isdigit() and len(norm) == 9:
        return f'{norm[:5]}-{norm[5:]}'
    return norm


def build_display_name(
    *,
    street: str = '',
    city: str = '',
    state: str = '',
    postal_code: str = '',
    country: str = '',
) -> str:
    parts: list[str] = []
    street_line = (street or '').strip()
    if street_line:
        parts.append(street_line)
    for value in (city, state):
        text = (value or '').strip()
        if text and text not in parts:
            parts.append(text)
    postal_display = format_postal_display(postal_code)
    if postal_display:
        parts.append(postal_display)
    country_text = (country or '').strip()
    if country_text and country_text not in parts:
        parts.append(country_text)
    return ', '.join(parts)


def _finalize_location_payload(payload: dict) -> dict:
    """Rebuild display_name from structured fields so postal codes stay consistent."""
    street = payload.get('street') or ''
    if not street and payload.get('display_name'):
        # Keep photon/nominatim street in display_name only when we have no structured street.
        display = (payload.get('display_name') or '').strip()
    else:
        display = build_display_name(
            street=street,
            city=payload.get('city') or '',
            state=payload.get('state') or '',
            postal_code=payload.get('postal_code') or '',
            country=payload.get('country') or '',
        )
        if not display:
            display = (payload.get('display_name') or '').strip()
    out = {**payload, 'display_name': display}
    out.pop('street', None)
    out.pop('source', None)
    return out


def _result_coord_key(payload: dict) -> str:
    try:
        lat = round(float(payload['latitude']), 4)
        lng = round(float(payload['longitude']), 4)
    except (KeyError, TypeError, ValueError):
        return (payload.get('display_name') or '').strip().lower()
    return f'{lat},{lng}'


def _merge_location_results(*groups: list[dict], limit: int = 5) -> list[dict]:
    """Merge provider results; prefer geocoder.ca and rows with a postal code."""
    source_rank = {
        'geocoder.ca': 0,
        'geocoder.ca_reverse': 1,
        'nominatim': 2,
        'photon': 3,
    }

    merged: dict[str, dict] = {}
    for group in groups:
        for item in group or []:
            if not item.get('display_name') and not item.get('city'):
                continue
            key = _result_coord_key(item)
            rank = source_rank.get(item.get('source', ''), 5)
            has_postal = bool((item.get('postal_code') or '').strip())
            existing = merged.get(key)
            if not existing:
                merged[key] = item
                continue
            existing_rank = source_rank.get(existing.get('source', ''), 5)
            existing_postal = bool((existing.get('postal_code') or '').strip())
            if rank < existing_rank or (rank == existing_rank and has_postal and not existing_postal):
                merged[key] = item

    ordered = sorted(
        merged.values(),
        key=lambda row: (
            source_rank.get(row.get('source', ''), 5),
            0 if (row.get('postal_code') or '').strip() else 1,
            row.get('display_name') or '',
        ),
    )
    return ordered[:limit]


def _parse_geocoder_ca_standard(item: dict) -> dict | None:
    standard = item.get('standard') or {}
    stnumber = standard.get('stnumber')
    if isinstance(stnumber, dict) or stnumber in (None, ''):
        stnumber_str = ''
    else:
        stnumber_str = str(stnumber).strip()
    street = (standard.get('staddress') or '').strip()
    street_line = ' '.join(p for p in (stnumber_str, street) if p).strip()
    city = (standard.get('city') or '').strip()
    prov_code = (standard.get('prov') or '').upper()
    province = _CA_PROVINCES.get(prov_code, prov_code)
    postal = normalize_postal_code(item.get('postal') or standard.get('postal') or '')
    lat = item.get('latt')
    lng = item.get('longt')
    country = 'Canada'
    if prov_code in {
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
        'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
        'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
    }:
        country = 'United States'
    display_name = build_display_name(
        street=street_line,
        city=city,
        state=province,
        postal_code=postal,
        country=country,
    )
    if not display_name:
        return None
    try:
        latitude = float(lat) if lat not in (None, '') else None
        longitude = float(lng) if lng not in (None, '') else None
    except (TypeError, ValueError):
        latitude = None
        longitude = None
    return {
        'display_name': display_name,
        'latitude': latitude,
        'longitude': longitude,
        'city': city,
        'state': province,
        'postal_code': postal,
        'country': country,
        'street': street_line,
        'source': 'geocoder.ca',
    }


def _geocoder_ca_reverse(lat: float, lng: float, *, allna: bool = False) -> dict | None:
    params = {
        'latt': f'{lat:.6f}',
        'longt': f'{lng:.6f}',
        'reverse': 1,
        'json': 1,
    }
    if allna:
        params['allna'] = 1
    url = f'{_GEOCODER_CA_URL}?{urlencode(params)}'
    req = Request(url, headers={'User-Agent': _USER_AGENT})
    try:
        with urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError, TypeError):
        return None
    items = data if isinstance(data, list) else [data]
    for item in items:
        if not isinstance(item, dict):
            continue
        parsed = _parse_geocoder_ca_standard(item)
        if parsed and parsed.get('latitude') is not None:
            parsed['source'] = 'geocoder.ca_reverse'
            return parsed
    return None


def _enrich_search_results(results: list[dict], *, country: str) -> list[dict]:
    """Fill missing or low-quality postcodes using geocoder.ca reverse lookup."""
    na_country = country and countries_match(country, 'Canada') or countries_match(country, 'United States')
    enriched: list[dict] = []
    for row in results:
        lat = row.get('latitude')
        lng = row.get('longitude')
        needs_postal = not (row.get('postal_code') or '').strip()
        if lat is not None and lng is not None and (needs_postal or na_country):
            reverse = _geocoder_ca_reverse(float(lat), float(lng), allna=countries_match(country, 'United States'))
            if reverse:
                row = {
                    **row,
                    'postal_code': reverse.get('postal_code') or row.get('postal_code') or '',
                    'city': row.get('city') or reverse.get('city') or '',
                    'state': row.get('state') or reverse.get('state') or '',
                    'country': row.get('country') or reverse.get('country') or country,
                    'street': row.get('street') or reverse.get('street') or '',
                }
                if reverse.get('source') == 'geocoder.ca_reverse' and reverse.get('street'):
                    row['street'] = reverse['street']
        enriched.append(_finalize_location_payload(row))
    return enriched


def _address_payload(result: dict) -> dict:
    address = result.get('address') or {}
    street_line = ' '.join(
        p for p in (address.get('house_number'), address.get('road') or address.get('street')) if p
    ).strip()
    city = (
        address.get('city')
        or address.get('town')
        or address.get('village')
        or address.get('municipality')
        or address.get('county')
        or ''
    )
    state = address.get('state') or address.get('province') or address.get('region') or ''
    postal_code = normalize_postal_code(address.get('postcode') or '')
    country = address.get('country') or ''
    return {
        'display_name': build_display_name(
            street=street_line,
            city=city,
            state=state,
            postal_code=postal_code,
            country=country,
        ) or (result.get('display_name') or ''),
        'latitude': float(result.get('lat')),
        'longitude': float(result.get('lon')),
        'city': city,
        'state': state,
        'postal_code': postal_code,
        'country': country,
        'street': street_line,
        'source': 'nominatim',
    }


def _photon_payload(feature: dict) -> dict | None:
    props = feature.get('properties') or {}
    coords = (feature.get('geometry') or {}).get('coordinates') or []
    if len(coords) < 2:
        return None
    lon, lat = coords[0], coords[1]
    street_line = ' '.join(
        p for p in (props.get('housenumber'), props.get('street')) if p
    ).strip()
    city = props.get('city') or props.get('locality') or props.get('district') or ''
    state = props.get('state') or ''
    postal_code = normalize_postal_code(props.get('postcode') or '')
    country = props.get('country') or ''
    return {
        'display_name': build_display_name(
            street=street_line,
            city=city,
            state=state,
            postal_code=postal_code,
            country=country,
        ),
        'latitude': float(lat),
        'longitude': float(lon),
        'city': city,
        'state': state,
        'postal_code': postal_code,
        'country': country,
        'street': street_line,
        'source': 'photon',
    }


def _photon_search(q: str, *, limit: int, country: str) -> list[dict]:
    queries = [q]
    if country and country.lower() not in q.lower():
        queries.append(f'{q}, {country}')

    for query_text in queries:
        results = _photon_search_request(query_text, limit=limit, country=country)
        if results:
            return results
    return []


def _photon_search_request(q: str, *, limit: int, country: str) -> list[dict]:
    # Over-fetch then filter — Photon has no reliable countrycodes param.
    fetch_limit = max(1, min(limit * 4 if country else limit, 16))
    params = [
        ('q', q),
        ('limit', str(fetch_limit)),
        ('lang', 'en'),
        ('layer', 'house'),
        ('layer', 'street'),
        ('layer', 'locality'),
    ]
    url = f'{_PHOTON_URL}?{urlencode(params)}'
    req = Request(url, headers={'User-Agent': _USER_AGENT})
    try:
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError, TypeError):
        return []

    results: list[dict] = []
    for feature in data.get('features') or []:
        try:
            payload = _photon_payload(feature)
            if not payload or not payload.get('display_name'):
                continue
            if country and not countries_match(payload.get('country', ''), country):
                continue
            results.append(payload)
        except (TypeError, ValueError):
            continue
        if len(results) >= limit:
            break
    return results


def _geocoder_ca_address_search(q: str, *, limit: int) -> list[dict]:
    url = f'{_GEOCODER_CA_URL}?{urlencode({"locate": q, "json": 1})}'
    req = Request(url, headers={'User-Agent': _USER_AGENT})
    try:
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError, TypeError):
        return []

    # geocoder.ca returns one object or a list depending on matches.
    items = data if isinstance(data, list) else [data]
    results: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        standard = item.get('standard') or {}
        stnumber = standard.get('stnumber')
        if isinstance(stnumber, dict) or stnumber in (None, ''):
            stnumber_str = ''
        else:
            stnumber_str = str(stnumber).strip()
        street = (standard.get('staddress') or '').strip()
        street_line = ' '.join(p for p in (stnumber_str, street) if p).strip()
        city = (standard.get('city') or '').strip()
        prov_code = (standard.get('prov') or '').upper()
        province = _CA_PROVINCES.get(prov_code, prov_code)
        postal = normalize_postal_code(item.get('postal') or '')
        lat = item.get('latt')
        lng = item.get('longt')
        parts = [p for p in (street_line, city, province, postal, 'Canada') if p]
        display_name = ', '.join(parts)
        if not display_name:
            continue
        try:
            results.append({
                'display_name': display_name,
                'latitude': float(lat) if lat not in (None, '') else None,
                'longitude': float(lng) if lng not in (None, '') else None,
                'city': city,
                'state': province,
                'postal_code': postal,
                'country': 'Canada',
            })
        except (TypeError, ValueError):
            continue
        if len(results) >= limit:
            break
    return results


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


def _min_search_length(q: str) -> int:
    return 1 if q.isdigit() else 2


def _nominatim_search(q: str, *, limit: int, country: str) -> list[dict]:
    nominatim_limit = max(1, min(limit, 8))
    if country:
        nominatim_limit = min(nominatim_limit * 2, 12)
    params: dict[str, str | int] = {
        'q': q,
        'format': 'json',
        'addressdetails': 1,
        'limit': nominatim_limit,
    }
    country_code = country_to_nominatim_code(country)
    if country_code:
        params['countrycodes'] = country_code
    url = f'{_NOMINATIM_URL}?{urlencode(params)}'
    req = Request(url, headers={'User-Agent': _USER_AGENT})
    try:
        with urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError, IndexError):
        return []
    results = []
    for result in data or []:
        try:
            payload = _address_payload(result)
            if country and not countries_match(payload.get('country', ''), country):
                continue
            results.append(payload)
        except (TypeError, ValueError):
            continue
        if len(results) >= limit:
            break
    return results


def _search_fallback_queries(q: str) -> list[str]:
    """Extra queries when the exact string returns nothing (typos / partial words)."""
    fallbacks: list[str] = []
    if ' ' in q:
        first_word = q.split()[0]
        if first_word and first_word != q and len(first_word) >= _min_search_length(first_word):
            fallbacks.append(first_word)
    elif len(q) >= 5:
        for trim in range(1, min(4, len(q) - 2)):
            shorter = q[:-trim].rstrip()
            if len(shorter) >= 3 and shorter not in fallbacks:
                fallbacks.append(shorter)
    return fallbacks


def search_locations(query: str, *, limit: int = 5, country: str = '') -> list[dict]:
    """Return address search results for map / booking location pickers."""
    q = (query or '').strip()
    if len(q) < _min_search_length(q):
        return []

    # Canadian postal / FSA → prefer geocoder.ca before Photon (avoids random worldwide hits).
    if country and countries_match('Canada', country) and is_canadian_postal(normalize_postal_code(q)):
        results = _geocoder_ca_address_search(q, limit=limit)
        if results:
            return results
        postal_hit = lookup_postal_location(q, country='Canada')
        if postal_hit and postal_hit.get('latitude') is not None:
            return [{
                'display_name': ', '.join(
                    p for p in (
                        postal_hit.get('city'),
                        postal_hit.get('state'),
                        postal_hit.get('postal_code'),
                        'Canada',
                    ) if p
                ),
                'latitude': postal_hit['latitude'],
                'longitude': postal_hit['longitude'],
                'city': postal_hit.get('city') or '',
                'state': postal_hit.get('state') or '',
                'postal_code': postal_hit.get('postal_code') or '',
                'country': 'Canada',
                'street': '',
                'source': 'postal',
            }]

    # Photon first — Nominatim public API is heavily rate-limited (HTTP 429).
    results = _photon_search(q, limit=limit, country=country)
    if results:
        return results

    if country and countries_match(country, 'Canada'):
        results = _geocoder_ca_address_search(q, limit=limit)
        if results:
            return results

    results = _nominatim_search(q, limit=limit, country=country)
    if results:
        return results

    for alt in _search_fallback_queries(q):
        results = _photon_search(alt, limit=limit, country=country)
        if results:
            return results
        results = _nominatim_search(alt, limit=limit, country=country)
        if results:
            return results
    return []


def _photon_reverse(lat: float, lng: float) -> dict | None:
    url = f'{_PHOTON_REVERSE_URL}?{urlencode({"lat": lat, "lon": lng})}'
    req = Request(url, headers={'User-Agent': _USER_AGENT})
    try:
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except (URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError, TypeError):
        return None
    features = data.get('features') or []
    if not features:
        return None
    return _photon_payload(features[0])


def reverse_geocode(lat: float, lng: float) -> dict | None:
    """Return an address-like payload for latitude/longitude."""
    result = _photon_reverse(lat, lng)
    if result and result.get('display_name'):
        return result

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
