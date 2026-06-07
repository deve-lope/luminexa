import re

from rest_framework import serializers

_POSTAL_RE = re.compile(r'^[A-Z0-9]+$')


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
