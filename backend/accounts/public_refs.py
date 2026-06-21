"""Sequential public IDs for customer accounts (cus1, cus2, …)."""

import re

from .models import User

_USER_REF_RE = re.compile(r'^cus(\d+)$')


def next_user_public_ref() -> str:
    refs = User.objects.exclude(public_ref='').values_list('public_ref', flat=True)
    max_n = 0
    for ref in refs:
        m = _USER_REF_RE.fullmatch(ref or '')
        if m:
            max_n = max(max_n, int(m.group(1)))
    return f'cus{max_n + 1}'


def ensure_user_public_ref(user: User) -> str:
    if user.public_ref:
        return user.public_ref
    user.public_ref = next_user_public_ref()
    user.save(update_fields=['public_ref'])
    return user.public_ref
