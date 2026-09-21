"""Customer service keyword search: tokens, synonyms, category + tagline expansion."""

from __future__ import annotations

import re

from django.db.models import Q

from .models import BusinessType

# Tokens kept for service-field matching but too weak to expand a whole platform category.
_CATEGORY_WEAK_TOKENS = frozenset({
    'interior',
    'exterior',
    'basic',
    'minor',
    'small',
    'home',
    'mobile',
    'care',
    'help',
    'service',
    'services',
    'job',
    'jobs',
    'work',
    'near',
    'area',
})

_PURE_STOPWORDS = frozenset({
    'a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'at', 'by',
    'with', 'from', 'my', 'our', 'your', 'me', 'i', 'we', 'you', 'is', 'are',
    'be', 'need', 'want', 'looking', 'find', 'get', 'some',
})

# Synonym clusters: any hit expands to all single-token members of the group.
_SYNONYM_GROUPS: tuple[frozenset[str], ...] = (
    frozenset({
        'detailing', 'detail', 'detailer', 'carwash', 'wash', 'washing',
        'auto', 'vehicle', 'vehicles', 'car', 'cars', 'valet',
        'shampoo', 'vacuum', 'steam',
    }),
    frozenset({
        'cleaning', 'clean', 'cleaner', 'housekeeping', 'maid', 'janitorial',
        'deep', 'sparkle',
    }),
    frozenset({
        'mowing', 'mow', 'lawn', 'yard', 'landscaping', 'landscape', 'garden',
        'hedge', 'hedges', 'leaf', 'leaves', 'snow',
    }),
    frozenset({
        'handyman', 'repair', 'repairs', 'fix', 'fixes', 'mounting', 'assembly',
    }),
    frozenset({
        'electrical', 'electric', 'outlet', 'outlets', 'fixture', 'fixtures', 'wiring',
    }),
    frozenset({
        'plumbing', 'plumber', 'faucet', 'faucets', 'toilet', 'toilets',
        'clog', 'clogs', 'leak', 'leaks',
    }),
    frozenset({
        'moving', 'movers', 'haul', 'hauling', 'junk', 'furniture',
    }),
    frozenset({
        'painting', 'painter', 'paint', 'touchup', 'touchups',
    }),
    frozenset({
        'pet', 'pets', 'dog', 'dogs', 'walking', 'sitting', 'grooming',
    }),
    frozenset({
        'hair', 'nails', 'barber', 'beauty', 'salon', 'wellness',
    }),
)

# Multi-word phrases that map into synonym tokens.
_PHRASE_SYNONYMS: tuple[tuple[str, frozenset[str]], ...] = (
    ('car wash', frozenset({'carwash', 'wash', 'detailing', 'auto'})),
    ('auto wash', frozenset({'carwash', 'wash', 'detailing', 'auto'})),
    ('interior detailing', frozenset({'detailing', 'detail', 'carwash', 'wash'})),
    ('interior clean', frozenset({'detailing', 'detail', 'carwash', 'wash', 'clean'})),
    ('interior cleaning', frozenset({'detailing', 'detail', 'carwash', 'wash', 'clean'})),
    ('deep clean', frozenset({'cleaning', 'clean', 'deep'})),
    ('deep cleaning', frozenset({'cleaning', 'clean', 'deep'})),
)

_TOKEN_RE = re.compile(r'[a-z0-9]+', re.IGNORECASE)


def _base_tokens(q: str) -> list[str]:
    """Significant lowercase tokens, including weak ones like 'interior'."""
    if not q:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for t in _TOKEN_RE.findall(q):
        t = t.lower()
        if len(t) < 3 or t in _PURE_STOPWORDS or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def expand_search_terms(q: str) -> list[str]:
    """Tokens + synonym expansions used for OR matching on service fields."""
    ql = (q or '').strip().lower()
    terms: set[str] = set(_base_tokens(q))

    for phrase, extras in _PHRASE_SYNONYMS:
        if phrase in ql:
            terms.update(extras)

    changed = True
    while changed:
        changed = False
        snapshot = set(terms)
        for group in _SYNONYM_GROUPS:
            if snapshot & group:
                before = len(terms)
                terms |= group
                if len(terms) > before:
                    changed = True

    return sorted(t for t in terms if len(t) >= 3 and t not in _PURE_STOPWORDS)


def _whole_word_in(haystack: str, term: str) -> bool:
    if not haystack or not term:
        return False
    return re.search(r'\b' + re.escape(term) + r'\b', haystack, re.IGNORECASE) is not None


def matching_business_type_names(q: str) -> list[str]:
    """Platform category names whose language matches strong search terms."""
    strong = [t for t in expand_search_terms(q) if t not in _CATEGORY_WEAK_TOKENS]
    if not strong:
        return []

    names: list[str] = []
    for bt in BusinessType.objects.filter(is_active=True).only('name', 'description', 'slug'):
        name = (bt.name or '').lower()
        desc = (bt.description or '').lower()
        slug = (bt.slug or '').lower().replace('-', ' ')
        slug_compact = slug.replace(' ', '')
        for term in strong:
            if (
                _whole_word_in(name, term)
                or _whole_word_in(desc, term)
                or _whole_word_in(slug, term)
                or term in slug_compact
            ):
                if bt.name and bt.name not in names:
                    names.append(bt.name)
                break
    return names


def service_keyword_filter(q: str) -> Q:
    """
    Match bookable services by phrase, tokens/synonyms, category expansion, or org tagline.

    Does not match organization name alone (avoids dumping unrelated catalog items).
    """
    phrase = (q or '').strip()
    if not phrase:
        return Q()

    filt = (
        Q(name__icontains=phrase)
        | Q(description__icontains=phrase)
        | Q(category__name__icontains=phrase)
    )

    for term in expand_search_terms(phrase):
        filt |= (
            Q(name__icontains=term)
            | Q(description__icontains=term)
            | Q(category__name__icontains=term)
        )

    for cat_name in matching_business_type_names(phrase):
        filt |= Q(category__name__iexact=cat_name)

    # Org specialty signal — tagline only, never org name.
    for term in [phrase, *expand_search_terms(phrase)]:
        if len(term) < 3:
            continue
        filt |= Q(organization__tagline__icontains=term)

    return filt


def service_is_phrase_match(service, q: str) -> bool:
    phrase = (q or '').strip().lower()
    if not phrase:
        return False
    name = (service.name or '').lower()
    desc = (service.description or '').lower()
    cat = ''
    if getattr(service, 'category_id', None) and getattr(service, 'category', None):
        cat = (service.category.name or '').lower()
    return phrase in name or phrase in desc or phrase in cat


def service_keyword_rank(service, q: str) -> int:
    """Lower is better: phrase-on-name → token-on-name → phrase elsewhere → token → expansion."""
    phrase = (q or '').strip().lower()
    name = (service.name or '').lower()
    desc = (service.description or '').lower()
    cat = ''
    if getattr(service, 'category_id', None) and getattr(service, 'category', None):
        cat = (service.category.name or '').lower()

    if phrase and phrase in name:
        return 0

    terms = expand_search_terms(q)
    for term in terms:
        if term in name:
            return 1

    if phrase and (phrase in desc or phrase in cat):
        return 2

    for term in terms:
        if term in desc or term in cat:
            return 3

    return 4


def sort_services_by_keyword(services: list, q: str, *, dist_map: dict | None = None) -> list:
    """Sort keyword hits; when location search is active, distance is primary among ranks."""
    if not q:
        if dist_map:
            return sorted(
                services,
                key=lambda s: (dist_map.get(s.organization_id, 10**9), (s.name or '').lower()),
            )
        return list(services)

    def key(s):
        rank = service_keyword_rank(s, q)
        if dist_map:
            return (dist_map.get(s.organization_id, 10**9), rank, (s.name or '').lower())
        return (rank, (s.name or '').lower())

    return sorted(services, key=key)


def keyword_match_mode(services: list, q: str) -> str | None:
    """Return 'exact', 'related', or None when there is no query."""
    phrase = (q or '').strip()
    if not phrase:
        return None
    if not services:
        return 'exact'
    if any(service_is_phrase_match(s, phrase) for s in services):
        return 'exact'
    return 'related'


def business_type_matches_query(bt, q: str) -> bool:
    """Whether a BusinessType should appear for free-text q (token / synonym aware)."""
    phrase = (q or '').strip().lower()
    if not phrase:
        return True
    name = (bt.name or '').lower()
    desc = (bt.description or '').lower()
    slug = (bt.slug or '').lower()
    if phrase in name or phrase in desc or phrase in slug:
        return True
    for term in expand_search_terms(phrase):
        if term in _CATEGORY_WEAK_TOKENS:
            continue
        if (
            _whole_word_in(name, term)
            or _whole_word_in(desc, term)
            or term in slug.replace('-', ' ')
            or term in slug.replace('-', '')
        ):
            return True
    return False
