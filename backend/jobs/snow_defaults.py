"""Default snow duration matrix and catalog service seeds (see docs/SNOW_ROUTE_DISPATCH.md)."""

# Minutes by work_type → house_type (owner-editable on Organization.snow_duration_matrix).
DEFAULT_SNOW_DURATION_MATRIX = {
    'roadside': {
        'detached': 5,
        'townhouse': 5,
        'duplex': 5,
        'shared_driveway': 5,
        'commercial': 10,
        'other': 5,
    },
    'driveway': {
        'detached': 10,
        'townhouse': 10,
        'duplex': 12,
        'shared_driveway': 15,
        'commercial': 30,
        'other': 10,
    },
    'front': {
        'detached': 15,
        'townhouse': 15,
        'duplex': 18,
        'shared_driveway': 20,
        'commercial': 40,
        'other': 15,
    },
    'full': {
        'detached': 20,
        'townhouse': 20,
        'duplex': 25,
        'shared_driveway': 30,
        'commercial': 60,
        'other': 20,
    },
}

# Catalog services for one-time invoices (provider sets prices later).
SNOW_SEED_SERVICES = (
    {'name': 'Snow — Roadside', 'work_key': 'roadside', 'duration_minutes': 5, 'sort_order': 10},
    {'name': 'Snow — Driveway', 'work_key': 'driveway', 'duration_minutes': 10, 'sort_order': 20},
    {'name': 'Snow — Front', 'work_key': 'front', 'duration_minutes': 15, 'sort_order': 30},
    {'name': 'Snow — Full', 'work_key': 'full', 'duration_minutes': 20, 'sort_order': 40},
)

SNOW_CATEGORY_NAME = 'Snow cleaning'


def default_snow_duration_matrix():
    """Deep copy suitable for JSONField defaults / seeding."""
    return {
        work: dict(houses)
        for work, houses in DEFAULT_SNOW_DURATION_MATRIX.items()
    }


def service_minutes_from_matrix(matrix, *, work_type: str, house_type: str) -> int:
    """Resolve minutes from matrix with safe fallbacks."""
    data = matrix or DEFAULT_SNOW_DURATION_MATRIX
    work = (data.get(work_type) or data.get('driveway') or {})
    minutes = work.get(house_type)
    if minutes is None:
        minutes = work.get('detached') or work.get('other') or 15
    return max(1, min(240, int(minutes)))


def validate_duration_matrix(matrix) -> dict:
    """Validate and normalize an owner-edited duration matrix."""
    if matrix is None or matrix == {}:
        return default_snow_duration_matrix()
    if not isinstance(matrix, dict):
        raise ValueError('Duration matrix must be an object.')
    base = default_snow_duration_matrix()
    out = {}
    for work_type, houses in base.items():
        src = matrix.get(work_type)
        if not isinstance(src, dict):
            raise ValueError(f'Missing or invalid work type: {work_type}')
        out[work_type] = {}
        for house_type in houses:
            if house_type not in src:
                raise ValueError(f'Missing {work_type}.{house_type}')
            try:
                minutes = int(src[house_type])
            except (TypeError, ValueError) as exc:
                raise ValueError(f'Invalid minutes for {work_type}.{house_type}') from exc
            if minutes < 1 or minutes > 240:
                raise ValueError(f'Minutes for {work_type}.{house_type} must be 1–240')
            out[work_type][house_type] = minutes
    return out
