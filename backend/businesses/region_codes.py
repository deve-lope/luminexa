"""Province/state resolution and reference postal codes for location pickers."""

from __future__ import annotations

import re

_CA = {
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

_US = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'District of Columbia',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois',
    'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
    'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
    'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon',
    'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota',
    'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia',
    'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
}

_NAME_TO_CODE = {name.lower(): code for code, name in {**_CA, **_US}.items()}
_CODE_TO_NAME = {**_CA, **_US}


def is_canadian_region(state: str) -> bool:
    return resolve_state_code(state) in _CA


def is_us_region(state: str) -> bool:
    return resolve_state_code(state) in _US

# Reference FSAs / ZIPs shown when picking a province or state (merged with provider data).
_REFERENCE_POSTAL = {
    'ON': [
        ('K1A', 'Ottawa'), ('K1B', 'Ottawa'), ('K1C', 'Ottawa'), ('K1G', 'Ottawa'),
        ('K1H', 'Ottawa'), ('K1J', 'Ottawa'), ('K1K', 'Ottawa'), ('K1L', 'Ottawa'),
        ('K1M', 'Ottawa'), ('K1N', 'Ottawa'), ('K1P', 'Ottawa'), ('K1R', 'Ottawa'),
        ('K1S', 'Ottawa'), ('K1T', 'Ottawa'), ('K1V', 'Ottawa'), ('K1W', 'Ottawa'),
        ('K1X', 'Ottawa'), ('K1Y', 'Ottawa'), ('K1Z', 'Ottawa'), ('K2A', 'Ottawa'),
        ('K2B', 'Ottawa'), ('K2C', 'Ottawa'), ('K2E', 'Ottawa'), ('K2G', 'Ottawa'),
        ('K2H', 'Ottawa'), ('K2J', 'Ottawa'), ('K2K', 'Ottawa'), ('K2L', 'Ottawa'),
        ('K2M', 'Ottawa'), ('K2P', 'Ottawa'), ('K2R', 'Ottawa'), ('K2S', 'Ottawa'),
        ('K2T', 'Ottawa'), ('K2V', 'Ottawa'), ('K2W', 'Ottawa'),
        ('M5V', 'Toronto'), ('M4B', 'Toronto'), ('M6G', 'Toronto'), ('M5A', 'Toronto'),
        ('M5B', 'Toronto'), ('M5C', 'Toronto'), ('M5E', 'Toronto'), ('M5G', 'Toronto'),
        ('L5B', 'Mississauga'), ('L5A', 'Mississauga'),
        ('N2L', 'Waterloo'), ('N2J', 'Waterloo'),
        ('L8P', 'Hamilton'), ('L8L', 'Hamilton'),
    ],
    'QC': [
        ('H2X', 'Montreal'), ('H3A', 'Montreal'), ('G1A', 'Quebec City'), ('J8X', 'Gatineau'),
    ],
    'BC': [('V5K', 'Vancouver'), ('V6B', 'Vancouver'), ('V8W', 'Victoria')],
    'AB': [('T2P', 'Calgary'), ('T3J', 'Calgary'), ('T5J', 'Edmonton'), ('T6E', 'Edmonton')],
    'MB': [('R3C', 'Winnipeg'), ('R2C', 'Winnipeg')],
    'SK': [('S4P', 'Regina'), ('S7K', 'Saskatoon')],
    'NS': [('B3H', 'Halifax'), ('B3J', 'Halifax')],
    'NB': [('E1A', 'Moncton'), ('E3B', 'Fredericton')],
    'NL': [('A1A', "St. John's"), ('A1C', "St. John's")],
    'PE': [('C1A', 'Charlottetown')],
    'TX': [('78701', 'Austin'), ('78702', 'Austin'), ('75201', 'Dallas'), ('77001', 'Houston')],
    'CA': [('90210', 'Beverly Hills'), ('94102', 'San Francisco'), ('90001', 'Los Angeles')],
    'NY': [('10001', 'New York'), ('11201', 'Brooklyn'), ('14201', 'Buffalo')],
    'FL': [('33101', 'Miami'), ('32801', 'Orlando'), ('33602', 'Tampa')],
    'IL': [('60601', 'Chicago'), ('60614', 'Chicago')],
    'WA': [('98101', 'Seattle'), ('99201', 'Spokane')],
}


def resolve_state_code(value: str) -> str:
    raw = (value or '').strip()
    if not raw:
        return ''
    upper = raw.upper()
    if upper in _CODE_TO_NAME:
        return upper
    return _NAME_TO_CODE.get(raw.lower(), '')


def state_matches(stored: str, selected: str) -> bool:
    """True when organization service_state matches the user's province/state pick."""
    if not selected:
        return True
    sel = selected.strip()
    if not sel:
        return True
    stored_val = (stored or '').strip()
    if not stored_val:
        return False
    if sel.lower() in stored_val.lower() or stored_val.lower() in sel.lower():
        return True
    sel_code = resolve_state_code(sel)
    stored_code = resolve_state_code(stored_val)
    if sel_code and stored_code and sel_code == stored_code:
        return True
    if sel_code and stored_val.upper() == sel_code:
        return True
    if stored_code and sel.upper() == stored_code:
        return True
    sel_name = _CODE_TO_NAME.get(sel_code, '')
    stored_name = _CODE_TO_NAME.get(stored_code, '')
    if sel_name and sel_name.lower() in stored_val.lower():
        return True
    if stored_name and stored_name.lower() in sel.lower():
        return True
    return False


def city_matches(stored: str, selected: str) -> bool:
    if not selected:
        return True
    sel = selected.strip().lower()
    if not sel:
        return True
    return sel in (stored or '').strip().lower()


def reference_postal_codes(*, state: str = '', city: str = '') -> list[str]:
    from .postal import picker_postal_codes

    code = resolve_state_code(state)
    if not code:
        return []
    entries = _REFERENCE_POSTAL.get(code, [])
    raw = []
    for postal, entry_city in entries:
        if city and not city_matches(entry_city, city):
            continue
        raw.append(postal)
    return picker_postal_codes(raw, state=state)


def reference_cities(*, state: str = '') -> list[str]:
    code = resolve_state_code(state)
    if not code:
        return []
    entries = _REFERENCE_POSTAL.get(code, [])
    seen = set()
    cities = []
    for _postal, entry_city in entries:
        key = entry_city.lower()
        if key not in seen:
            seen.add(key)
            cities.append(entry_city)
    return sorted(cities, key=str.lower)


def merge_unique_sorted(*lists: list[str], limit: int = 200) -> list[str]:
    seen = set()
    out = []
    for lst in lists:
        for item in lst:
            val = (item or '').strip()
            if not val:
                continue
            key = val.upper()
            if key in seen:
                continue
            seen.add(key)
            out.append(val)
    out.sort(key=lambda x: x.upper())
    return out[:limit]
