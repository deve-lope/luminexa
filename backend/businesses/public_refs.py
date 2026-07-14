"""Sequential public IDs for organizations (pro1, pro2, …)."""

import re

from .models import Organization

_ORG_REF_RE = re.compile(r'^pro(\d+)$')


def next_organization_public_ref() -> str:
    refs = Organization.objects.exclude(public_ref='').values_list('public_ref', flat=True)
    max_n = 0
    for ref in refs:
        m = _ORG_REF_RE.fullmatch(ref or '')
        if m:
            max_n = max(max_n, int(m.group(1)))
    return f'pro{max_n + 1}'


def ensure_organization_public_ref(org: Organization) -> str:
    if org.public_ref:
        return org.public_ref
    org.public_ref = next_organization_public_ref()
    org.save(update_fields=['public_ref', 'updated_at'])
    return org.public_ref


def resolve_organization(key: str | None):
    """Look up an organization by public ref (pro12) or legacy slug."""
    if not key:
        return None
    key = key.strip()
    if _ORG_REF_RE.fullmatch(key):
        org = Organization.objects.filter(public_ref=key).first()
        if org:
            return org
    return Organization.objects.filter(slug=key).first()
