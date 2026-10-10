"""Parse and validate structured booking service addresses.

Matches the labeled storage format produced by the frontend
``ServiceLocationInput`` / ``formatServiceAddress``:

    Country: Canada
    Province: Ontario
    City: Toronto
    Address 1: 123 Main St
    Address 2: Apt 4
    Postal code: M5V2T6
"""

from __future__ import annotations

import re

from rest_framework.exceptions import ValidationError

from businesses.postal import normalize_postal_code, validate_postal_code

_FIELD_LABELS = (
    'Country',
    'Province',
    'City',
    'Address 1',
    'Address 2',
    'Postal code',
)
_LABEL_RE = re.compile(
    r'(' + '|'.join(re.escape(label) for label in _FIELD_LABELS) + r')\s*:\s*',
    re.IGNORECASE,
)
_CA_POSTAL_RE = re.compile(r'^[A-Z]\d[A-Z]\d[A-Z]\d$')
_US_ZIP_RE = re.compile(r'^\d{5}(\d{4})?$')
_MX_POSTAL_RE = re.compile(r'^\d{5}$')
_BR_POSTAL_RE = re.compile(r'^\d{8}$')


def parse_service_address(value: str) -> dict[str, str]:
    """Parse labeled or legacy comma-separated service address text."""
    raw = (value or '').strip()
    empty = {
        'country': '',
        'province': '',
        'city': '',
        'address1': '',
        'address2': '',
        'postal_code': '',
    }
    if not raw:
        return empty

    if _LABEL_RE.search(raw) and re.search(r'(?:address\s*1|city)\s*:', raw, re.I):
        hits = list(_LABEL_RE.finditer(raw))
        fields = dict(empty)
        key_map = {
            'country': 'country',
            'province': 'province',
            'city': 'city',
            'address 1': 'address1',
            'address 2': 'address2',
            'postal code': 'postal_code',
        }
        for i, hit in enumerate(hits):
            end = hits[i + 1].start() if i + 1 < len(hits) else len(raw)
            key = key_map.get(hit.group(1).lower())
            if key:
                fields[key] = raw[hit.end():end].strip()
        return fields

    parts = [part.strip() for part in raw.split(',') if part.strip()]
    fields = dict(empty)
    # Heuristic: trailing CA/US/MX/BR postal, then province, city, rest street.
    if parts:
        last = normalize_postal_code(parts[-1])
        if (
            _CA_POSTAL_RE.match(last)
            or _US_ZIP_RE.match(last)
            or _MX_POSTAL_RE.match(last)
            or _BR_POSTAL_RE.match(last)
        ):
            fields['postal_code'] = last
            parts = parts[:-1]
        if len(parts) >= 3:
            fields['province'] = parts[-1]
            fields['city'] = parts[-2]
            fields['address1'] = ', '.join(parts[:-2])
        elif len(parts) == 2:
            fields['city'] = parts[-1]
            fields['address1'] = parts[0]
        elif len(parts) == 1:
            fields['address1'] = parts[0]
    return fields


def _validate_postal_for_country(postal_code: str, country: str) -> str:
    normalized = normalize_postal_code(postal_code)
    if not normalized:
        raise ValidationError({
            'service_address': 'Enter a postal / ZIP / PIN code.',
        })

    country_name = (country or '').strip()
    if country_name == 'Canada' or _CA_POSTAL_RE.match(normalized):
        if not _CA_POSTAL_RE.match(normalized):
            raise ValidationError({
                'service_address': 'Enter a valid Canadian postal code (e.g. M5V 2T6).',
            })
        return normalized
    if country_name == 'United States':
        if not _US_ZIP_RE.match(normalized):
            raise ValidationError({
                'service_address': 'Enter a valid US ZIP code (5 or 9 digits).',
            })
        return normalized
    if country_name == 'Mexico':
        if not _MX_POSTAL_RE.match(normalized):
            raise ValidationError({
                'service_address': 'Enter a valid 5-digit Mexican postal code.',
            })
        return normalized
    if country_name == 'Brazil':
        if not _BR_POSTAL_RE.match(normalized):
            raise ValidationError({
                'service_address': 'Enter a valid 8-digit Brazilian CEP code.',
            })
        return normalized

    try:
        return validate_postal_code(normalized)
    except ValidationError as exc:
        detail = exc.detail
        if isinstance(detail, list) and detail:
            message = str(detail[0])
        else:
            message = str(detail)
        raise ValidationError({'service_address': message}) from exc


def validate_structured_service_address(value: str) -> str:
    """
    Require street, city, province/state, and a country-appropriate postal code.

    Returns the stripped original storage string (does not reformat).
    """
    address = (value or '').strip()
    if not address:
        raise ValidationError({
            'service_address': 'Enter the address where the provider should come.',
        })

    fields = parse_service_address(address)
    if not fields['address1']:
        raise ValidationError({
            'service_address': 'Please enter address line 1.',
        })
    if not fields['city']:
        raise ValidationError({
            'service_address': 'Please enter the city.',
        })
    if not fields['province']:
        raise ValidationError({
            'service_address': 'Please enter the province / state.',
        })
    _validate_postal_for_country(fields['postal_code'], fields['country'])
    return address


def is_valid_structured_service_address(value: str) -> bool:
    try:
        validate_structured_service_address(value)
        return True
    except ValidationError:
        return False


def _format_postal_for_query(postal_code: str) -> str:
    normalized = normalize_postal_code(postal_code)
    if not normalized:
        return ''
    if _CA_POSTAL_RE.match(normalized):
        return f'{normalized[:3]} {normalized[3:]}'
    return normalized


def format_service_address_for_geocode(value: str) -> str:
    """
    Single-line query for Nominatim / Photon / Maps.

    Labeled storage (``Country: …\\nAddress 1: …``) fails geocoders; this matches
    the frontend ``formatServiceAddressForMaps`` shape.
    """
    fields = parse_service_address(value)
    parts: list[str] = []
    if fields['address1']:
        parts.append(fields['address1'])
    a2 = (fields['address2'] or '').strip()
    a1 = (fields['address1'] or '').strip()
    if a2 and a2.lower() not in a1.lower():
        parts.append(a2)
    if fields['city']:
        parts.append(fields['city'])
    if fields['province']:
        parts.append(fields['province'])
    postal = _format_postal_for_query(fields['postal_code'])
    if postal:
        parts.append(postal)
    if fields['country']:
        parts.append(fields['country'])
    if parts:
        return ', '.join(parts)

    stripped = re.sub(
        r'(?:^|\n)\s*(?:Country|Province|City|Address 1|Address 2|Postal code)\s*:\s*',
        ' ',
        str(value or ''),
        flags=re.IGNORECASE,
    )
    return re.sub(r'\s+', ' ', stripped).strip()


def geocode_query_variants(value: str) -> list[str]:
    """Ordered unique queries to try when geocoding a job address."""
    raw = (value or '').strip()
    primary = format_service_address_for_geocode(raw)
    fields = parse_service_address(raw)
    variants: list[str] = []

    def add(q: str) -> None:
        q = (q or '').strip()
        if len(q) >= 5 and q not in variants:
            variants.append(q)

    add(primary)
    # Street + city + postal (often enough for Nominatim).
    if fields['address1'] and fields['city']:
        postal = _format_postal_for_query(fields['postal_code'])
        bits = [fields['address1'], fields['city']]
        if fields['province']:
            bits.append(fields['province'])
        if postal:
            bits.append(postal)
        add(', '.join(bits))
    if raw and raw != primary:
        add(raw.replace('\n', ', '))
    return variants
