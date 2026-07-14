import re

from rest_framework import serializers

_POSTAL_RE = re.compile(r'^[A-Z0-9]+$')
_CA_FSA_RE = re.compile(r'^[A-Z]\d[A-Z]$')
_CA_FULL_RE = re.compile(r'^[A-Z]\d[A-Z]\d[A-Z]\d$')
_US_ZIP_RE = re.compile(r'^\d{5}(\d{4})?$')


def normalize_postal_code(value: str) -> str:
    """Strip spaces/dashes and uppercase for consistent storage and matching."""
    if not value:
        return ''
    return re.sub(r'[\s\-]+', '', str(value).strip().upper())


def validate_postal_code(value: str) -> str:
    normalized = normalize_postal_code(value)
    if len(normalized) < 3:
        raise serializers.ValidationError(
            'Enter a valid PIN / postal code (at least 3 characters).'
        )
    if len(normalized) > 10:
        raise serializers.ValidationError('PIN / postal code is too long.')
    if not _POSTAL_RE.match(normalized):
        raise serializers.ValidationError('Use only letters and numbers in the PIN / postal code.')
    return normalized


def is_canadian_postal(code: str) -> bool:
    norm = normalize_postal_code(code)
    return bool(_CA_FSA_RE.match(norm) or _CA_FULL_RE.match(norm))


def is_complete_postal_code(code: str, *, state: str = '') -> bool:
    """True when code is a full Canadian postal (6) or US ZIP (5+)."""
    from .region_codes import is_canadian_region

    norm = normalize_postal_code(code)
    if not norm:
        return False
    ca = is_canadian_region(state) or is_canadian_postal(norm)
    if ca:
        return bool(_CA_FULL_RE.match(norm))
    return bool(_US_ZIP_RE.match(norm))


def to_picker_postal_code(code: str, *, state: str = '') -> str:
    """Normalize a stored/reference code to a complete picker value."""
    from .region_codes import is_canadian_region

    norm = normalize_postal_code(code)
    if not norm:
        return ''
    ca = is_canadian_region(state) or is_canadian_postal(norm)
    if ca:
        if _CA_FULL_RE.match(norm):
            return norm
        if _CA_FSA_RE.match(norm):
            return f'{norm}0A1'
        return ''
    if norm.isdigit() and len(norm) >= 5:
        return norm[:5]
    return ''


def picker_postal_codes(codes: list[str], *, state: str = '') -> list[str]:
    """Unique complete postal/ZIP codes for dropdowns (no bare 3-letter FSAs)."""
    from .region_codes import is_canadian_region

    converted = []
    for code in codes:
        full = to_picker_postal_code(code, state=state)
        if full:
            converted.append(full)

    if not is_canadian_region(state) and not any(is_canadian_postal(c) for c in codes):
        return sorted(set(converted), key=str.upper)

    by_fsa: dict[str, list[str]] = {}
    for postal in converted:
        by_fsa.setdefault(postal[:3], []).append(postal)

    out = []
    for group in by_fsa.values():
        real = sorted({p for p in group if not p.endswith('0A1')}, key=str.upper)
        if real:
            out.extend(real)
        else:
            out.append(group[0])
    return sorted(set(out), key=str.upper)
