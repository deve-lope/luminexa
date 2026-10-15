"""Open-Meteo snowfall adapter (free host for beta; paid key for commercial)."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import requests
from django.conf import settings
from django.core.cache import cache


def _host_and_params() -> tuple[str, dict]:
    key = (getattr(settings, 'OPEN_METEO_API_KEY', '') or '').strip()
    if key:
        return 'https://customer-api.open-meteo.com/v1/forecast', {'apikey': key}
    return 'https://api.open-meteo.com/v1/forecast', {}


def get_daily_snowfall_cm(
    lat: float,
    lng: float,
    *,
    days: int = 7,
    tz: str = 'America/Toronto',
) -> list[dict[str, Any]]:
    days = max(1, min(14, int(days)))
    cache_key = f'snowfall:{round(lat, 2)}:{round(lng, 2)}:{days}:{tz}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    host, extra = _host_and_params()
    params = {
        'latitude': lat,
        'longitude': lng,
        'daily': 'snowfall_sum',
        'timezone': tz or 'America/Toronto',
        'forecast_days': days,
        **extra,
    }
    try:
        resp = requests.get(host, params=params, timeout=12)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        # Soft-fail: empty forecast so UI still works offline.
        today = date.today()
        return [{'date': (today + timedelta(days=i)).isoformat(), 'snowfall_cm': 0.0} for i in range(days)]

    daily = data.get('daily') or {}
    times = daily.get('time') or []
    snow = daily.get('snowfall_sum') or []
    out = []
    for i, day in enumerate(times):
        cm = float(snow[i] or 0) if i < len(snow) else 0.0
        out.append({'date': day, 'snowfall_cm': round(cm, 1)})
    cache.set(cache_key, out, 3 * 3600)
    return out
