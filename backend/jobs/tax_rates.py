"""Sales tax for invoices from the business (organization) address.

Canada: federal GST and/or provincial PST/QST, or combined HST.
United States: state-level sales tax only (no federal sales tax).
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

TWOPLACES = Decimal('0.01')
ZERO = Decimal('0.00')

_CA_PROVINCE_ALIASES = {
    'alberta': 'AB', 'ab': 'AB',
    'british columbia': 'BC', 'bc': 'BC',
    'manitoba': 'MB', 'mb': 'MB',
    'new brunswick': 'NB', 'nb': 'NB',
    'newfoundland': 'NL', 'newfoundland and labrador': 'NL', 'nl': 'NL',
    'northwest territories': 'NT', 'nt': 'NT',
    'nova scotia': 'NS', 'ns': 'NS',
    'nunavut': 'NU', 'nu': 'NU',
    'ontario': 'ON', 'on': 'ON',
    'prince edward island': 'PE', 'pei': 'PE', 'pe': 'PE',
    'quebec': 'QC', 'québec': 'QC', 'qc': 'QC',
    'saskatchewan': 'SK', 'sk': 'SK',
    'yukon': 'YT', 'yt': 'YT',
}

_US_STATE_ALIASES = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'district of columbia': 'DC', 'washington dc': 'DC', 'florida': 'FL',
    'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL',
    'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS', 'kentucky': 'KY',
    'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD', 'massachusetts': 'MA',
    'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
    'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH',
    'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
    'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI',
    'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN',
    'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA',
    'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
}
for _code in list(_US_STATE_ALIASES.values()):
    _US_STATE_ALIASES[_code.lower()] = _code

# Canada POS rates: HST = combined federal+provincial; else GST + provincial.
_CA_TAX = {
    'AB': [('GST', 'GST (federal)', Decimal('0.05'))],
    'BC': [
        ('GST', 'GST (federal)', Decimal('0.05')),
        ('PST', 'PST (BC)', Decimal('0.07')),
    ],
    'MB': [
        ('GST', 'GST (federal)', Decimal('0.05')),
        ('RST', 'RST (MB)', Decimal('0.07')),
    ],
    'NB': [('HST', 'HST (federal + provincial)', Decimal('0.15'))],
    'NL': [('HST', 'HST (federal + provincial)', Decimal('0.15'))],
    'NS': [('HST', 'HST (federal + provincial)', Decimal('0.15'))],
    'NT': [('GST', 'GST (federal)', Decimal('0.05'))],
    'NU': [('GST', 'GST (federal)', Decimal('0.05'))],
    'ON': [('HST', 'HST (federal + provincial)', Decimal('0.13'))],
    'PE': [('HST', 'HST (federal + provincial)', Decimal('0.15'))],
    'QC': [
        ('GST', 'GST (federal)', Decimal('0.05')),
        ('QST', 'QST (QC)', Decimal('0.09975')),
    ],
    'SK': [
        ('GST', 'GST (federal)', Decimal('0.05')),
        ('PST', 'PST (SK)', Decimal('0.06')),
    ],
    'YT': [('GST', 'GST (federal)', Decimal('0.05'))],
}

_US_STATE_RATE = {
    'AL': Decimal('0.04'), 'AK': Decimal('0.00'), 'AZ': Decimal('0.056'),
    'AR': Decimal('0.065'), 'CA': Decimal('0.0725'), 'CO': Decimal('0.029'),
    'CT': Decimal('0.0635'), 'DE': Decimal('0.00'), 'DC': Decimal('0.06'),
    'FL': Decimal('0.06'), 'GA': Decimal('0.04'), 'HI': Decimal('0.04'),
    'ID': Decimal('0.06'), 'IL': Decimal('0.0625'), 'IN': Decimal('0.07'),
    'IA': Decimal('0.06'), 'KS': Decimal('0.065'), 'KY': Decimal('0.06'),
    'LA': Decimal('0.0445'), 'ME': Decimal('0.055'), 'MD': Decimal('0.06'),
    'MA': Decimal('0.0625'), 'MI': Decimal('0.06'), 'MN': Decimal('0.06875'),
    'MS': Decimal('0.07'), 'MO': Decimal('0.04225'), 'MT': Decimal('0.00'),
    'NE': Decimal('0.055'), 'NV': Decimal('0.0685'), 'NH': Decimal('0.00'),
    'NJ': Decimal('0.06625'), 'NM': Decimal('0.05125'), 'NY': Decimal('0.04'),
    'NC': Decimal('0.0475'), 'ND': Decimal('0.05'), 'OH': Decimal('0.0575'),
    'OK': Decimal('0.045'), 'OR': Decimal('0.00'), 'PA': Decimal('0.06'),
    'RI': Decimal('0.07'), 'SC': Decimal('0.06'), 'SD': Decimal('0.045'),
    'TN': Decimal('0.07'), 'TX': Decimal('0.0625'), 'UT': Decimal('0.0485'),
    'VT': Decimal('0.06'), 'VA': Decimal('0.053'), 'WA': Decimal('0.065'),
    'WV': Decimal('0.06'), 'WI': Decimal('0.05'), 'WY': Decimal('0.04'),
}


def _money(value: Decimal) -> Decimal:
    return value.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def normalize_region(value: str) -> str:
    key = (value or '').strip().lower()
    if not key:
        return ''
    if key in _CA_PROVINCE_ALIASES:
        return _CA_PROVINCE_ALIASES[key]
    if key in _US_STATE_ALIASES:
        return _US_STATE_ALIASES[key]
    if len(key) == 2:
        return key.upper()
    return ''


def infer_country_from_region(region: str) -> str:
    code = normalize_region(region)
    if code in _CA_TAX:
        return 'CA'
    if code in _US_STATE_RATE:
        return 'US'
    return ''


def resolve_business_jurisdiction(organization) -> dict[str, str]:
    """Tax jurisdiction from organization business / service address."""
    region = normalize_region(getattr(organization, 'service_state', '') or '')
    country = ''
    raw_country = (getattr(organization, 'service_country', None) or '').strip().lower()
    if raw_country in ('canada', 'ca'):
        country = 'CA'
    elif raw_country in ('united states', 'usa', 'us', 'united states of america'):
        country = 'US'
    if not country:
        country = infer_country_from_region(region)
    currency = 'CAD' if country == 'CA' else 'USD' if country == 'US' else 'CAD'
    return {
        'tax_country': country,
        'tax_region': region if country else '',
        'currency': currency,
        'business_state': (getattr(organization, 'service_state', '') or '').strip(),
        'business_city': (getattr(organization, 'service_city', '') or '').strip(),
    }


def tax_components_for(country: str, region: str) -> list[tuple[str, str, Decimal]]:
    region = normalize_region(region)
    if country == 'CA':
        if region in _CA_TAX:
            return list(_CA_TAX[region])
        # Province unknown but Canada: federal GST only
        return [('GST', 'GST (federal)', Decimal('0.05'))] if country == 'CA' else []
    if country == 'US':
        rate = _US_STATE_RATE.get(region)
        if rate is None or rate == ZERO:
            return []
        return [('STATE', f'State sales tax ({region})', rate)]
    return []


def calculate_tax(*, subtotal: Decimal, country: str, region: str) -> dict[str, Any]:
    """Compute tax lines and totals from a pre-tax subtotal."""
    subtotal = _money(Decimal(subtotal or 0))
    components = tax_components_for(country, region)
    lines = []
    tax_total = ZERO
    for code, name, rate in components:
        amount = _money(subtotal * rate)
        tax_total += amount
        lines.append({
            'code': code,
            'name': name,
            'rate': str(rate),
            'amount': str(amount),
        })
    total = _money(subtotal + tax_total)
    return {
        'subtotal': subtotal,
        'tax_lines': lines,
        'tax_total': tax_total,
        'total': total,
        'tax_country': country or '',
        'tax_region': normalize_region(region),
        'currency': 'CAD' if country == 'CA' else 'USD' if country == 'US' else 'CAD',
    }


def calculate_tax_for_organization(organization, subtotal: Decimal) -> dict[str, Any]:
    juris = resolve_business_jurisdiction(organization)
    result = calculate_tax(
        subtotal=subtotal,
        country=juris['tax_country'],
        region=juris['tax_region'],
    )
    if juris['tax_country']:
        result['currency'] = juris['currency']
    result['business_state'] = juris['business_state']
    result['business_city'] = juris['business_city']
    return result
