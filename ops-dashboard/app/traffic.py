"""Website traffic from frontend nginx access logs (shared Docker volume)."""

from __future__ import annotations

import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Legacy nginx combined
COMBINED_RE = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[(?P<ts>[^\]]+)\] '
    r'"(?P<method>[A-Z]+) (?P<path>[^"]*) HTTP/[^"]*" '
    r'(?P<status>\d{3}) (?P<size>\S+) "(?P<ref>[^"]*)" "(?P<ua>[^"]*)"'
    r'(?: cf_country=(?P<country>\S+))?$'
)

SCAN_PATH = re.compile(
    r'(\.env|wp-admin|wp-login|phpunit|\.php($|\?)|graphql|/admin|'
    r'vendor/|\.git|xmlrpc|terraform|proc/self|wp-content|wp-json|'
    r'eval-stdin|swagger|playground|api-keys|/console)',
    re.I,
)
BOT_UA = re.compile(
    r'bot|crawl|spider|curl/|python-|httpx|scanner|bytespider|semrush|'
    r'ahrefs|bingpreview|facebookexternal|slurp|gptbot|claudebot|petalbot',
    re.I,
)
STATIC = re.compile(
    r'\.(?:js|css|map|png|jpe?g|svg|ico|woff2?|txt|webp|json)(?:\?|$)',
    re.I,
)
API = re.compile(r'^/(?:api/|accounts/)')
PUBLIC_PAGE = re.compile(
    r'^/(?:$|login/?$|register/?$|pricing/?$|privacy/?$|terms/?$|services/?$|'
    r'ottawa(?:/|$)|toronto(?:/|$)|book/|b/|find/?$|reset-password|customer|'
    r'provider|offer)',
    re.I,
)

SESSION_GAP = timedelta(minutes=30)


def _parse_ts(raw: str) -> datetime | None:
    try:
        return datetime.strptime(raw, '%d/%b/%Y:%H:%M:%S %z')
    except ValueError:
        return None


def _path_only(raw: str) -> str:
    path = (raw or '/').split(' ', 1)[0]
    return path.split('?', 1)[0] or '/'


def country_flag(code: str | None) -> str:
    """ISO country code → flag emoji (best-effort)."""
    if not code:
        return '🌐'
    c = code.strip().upper()
    if len(c) != 2 or not c.isalpha() or c in ('XX', 'T1', 'ZZ'):
        return '🌐'
    return chr(0x1F1E6 + ord(c[0]) - ord('A')) + chr(0x1F1E6 + ord(c[1]) - ord('A'))


def _fmt_duration(seconds: float, page_views: int = 1) -> str:
    secs = max(0, int(seconds))
    if secs < 1:
        return 'under 1s' if page_views > 1 else 'single page'
    if secs < 60:
        return f'{secs}s'
    mins, secs = divmod(secs, 60)
    if mins < 60:
        return f'{mins}m {secs}s' if secs else f'{mins}m'
    hours, mins = divmod(mins, 60)
    return f'{hours}h {mins}m'


def _is_private_ip(ip: str) -> bool:
    """Docker / LAN / loopback — not a public website visitor."""
    if not ip or ip in ('-', 'unknown'):
        return True
    if ip.startswith(('10.', '127.', '172.')):
        # 172.16.0.0 – 172.31.255.255 is private; Docker bridge is usually 172.16–31.
        if ip.startswith('172.'):
            try:
                second = int(ip.split('.')[1])
            except (IndexError, ValueError):
                return True
            return 16 <= second <= 31
        return True
    if ip.startswith('192.168.'):
        return True
    if ip.startswith('100.'):
        # Tailscale CGNAT — treat as local ops traffic, not public site visitors.
        try:
            second = int(ip.split('.')[1])
        except (IndexError, ValueError):
            return False
        return 64 <= second <= 127
    if ':' in ip and (ip.startswith('fc') or ip.startswith('fd') or ip == '::1'):
        return True
    return False


def _sessionize(hits: list[dict]) -> list[dict]:
    """Group hits by IP into sessions (gap > 30m starts a new visit)."""
    by_ip: dict[str, list[dict]] = defaultdict(list)
    for h in hits:
        by_ip[h['ip']].append(h)
    sessions: list[dict] = []
    for ip, rows in by_ip.items():
        rows.sort(key=lambda r: r['ts'])
        current: list[dict] = []
        for row in rows:
            if current and (row['ts'] - current[-1]['ts']) > SESSION_GAP:
                sessions.append(_session_from_hits(ip, current))
                current = []
            current.append(row)
        if current:
            sessions.append(_session_from_hits(ip, current))
    sessions.sort(key=lambda s: s['ended_at'], reverse=True)
    return sessions


def _session_from_hits(ip: str, hits: list[dict]) -> dict:
    start = hits[0]['ts']
    end = hits[-1]['ts']
    duration = (end - start).total_seconds()
    countries = [h.get('country') for h in hits if h.get('country')]
    country = countries[-1] if countries else ''
    paths = [h['path'] for h in hits]
    page_views = len(hits)
    return {
        'ip': ip,
        'country': country,
        'flag': country_flag(country),
        'started_at': start,
        'ended_at': end,
        'duration_sec': duration,
        'duration_label': _fmt_duration(duration, page_views),
        'page_views': page_views,
        'pages': paths[:8],
        'pages_extra': max(0, len(paths) - 8),
        'local': _is_private_ip(ip),
    }


def load_traffic(since: datetime | None = None) -> dict:
    log_path = Path(
        (os.environ.get('NGINX_ACCESS_LOG') or '/var/log/nginx/luminexa.access.log').strip()
    )
    empty = {
        'available': False,
        'log_path': str(log_path),
        'hits_total': 0,
        'hits_public': 0,
        'unique_ips': 0,
        'sessions': 0,
        'bots_scans': 0,
        'top_pages': [],
        'by_day': [],
        'by_hour': [],
        'by_country': [],
        'recent': [],
        'visits': [],
        'chart_days': {'labels': [], 'hits': [], 'sessions': []},
        'chart_hours': {'labels': [], 'hits': []},
        'chart_pages': {'labels': [], 'hits': []},
        'chart_countries': {'labels': [], 'hits': []},
    }
    if not log_path.is_file():
        return empty

    if since and since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)

    public_hits = 0
    bots = 0
    pages: Counter[str] = Counter()
    by_day: Counter[str] = Counter()
    by_hour: Counter[str] = Counter()
    by_country: Counter[str] = Counter()
    ips: set[str] = set()
    hit_rows: list[dict] = []
    total = 0

    try:
        text = log_path.read_text(encoding='utf-8', errors='replace')
    except OSError:
        return empty

    for line in text.splitlines():
        m = COMBINED_RE.match(line.strip())
        if not m:
            continue
        ts = _parse_ts(m.group('ts'))
        if ts is None:
            continue
        if since and ts < since:
            continue
        total += 1
        method = m.group('method')
        status = m.group('status')
        ua = m.group('ua') or ''
        ip = m.group('ip')
        path = _path_only(m.group('path'))
        country = (m.groupdict().get('country') or '').strip()
        if country in ('-', ''):
            country = ''

        if method not in ('GET', 'HEAD'):
            continue
        if SCAN_PATH.search(path) or BOT_UA.search(ua):
            bots += 1
            continue
        if STATIC.search(path) or API.search(path):
            continue
        if status not in ('200', '304'):
            continue
        if not PUBLIC_PAGE.search(path):
            continue
        # Skip Docker/LAN/Tailscale — keep charts focused on public visitors.
        if _is_private_ip(ip):
            continue

        public_hits += 1
        ips.add(ip)
        pages[path] += 1
        day = ts.astimezone(timezone.utc).strftime('%Y-%m-%d')
        hour = ts.astimezone(timezone.utc).strftime('%H:00')
        by_day[day] += 1
        by_hour[hour] += 1
        if country:
            by_country[country] += 1
        hit_rows.append(
            {
                'ts': ts,
                'path': path,
                'ip': ip,
                'status': status,
                'country': country,
                'flag': country_flag(country),
            }
        )

    visits = _sessionize(hit_rows)
    sessions_by_day: Counter[str] = Counter()
    for v in visits:
        sessions_by_day[v['started_at'].astimezone(timezone.utc).strftime('%Y-%m-%d')] += 1

    day_labels = sorted(set(by_day) | set(sessions_by_day))
    hour_labels = [f'{h:02d}:00' for h in range(24)]
    hour_hits = [by_hour.get(f'{h:02d}:00', 0) for h in range(24)]
    top_pages = pages.most_common(10)
    top_countries = by_country.most_common(10)

    hit_rows.sort(key=lambda r: r['ts'], reverse=True)
    return {
        'available': True,
        'log_path': str(log_path),
        'hits_total': total,
        'hits_public': public_hits,
        'unique_ips': len(ips),
        'sessions': len(visits),
        'bots_scans': bots,
        'top_pages': [{'path': p, 'c': c} for p, c in top_pages],
        'by_day': [{'day': d, 'c': by_day[d]} for d in sorted(by_day)],
        'by_hour': [{'hour': h, 'c': c} for h, c in zip(hour_labels, hour_hits) if c],
        'by_country': [
            {'country': c, 'flag': country_flag(c), 'c': n} for c, n in top_countries
        ],
        'recent': hit_rows[:40],
        'visits': visits[:50],
        'chart_days': {
            'labels': day_labels,
            'hits': [by_day.get(d, 0) for d in day_labels],
            'sessions': [sessions_by_day.get(d, 0) for d in day_labels],
        },
        'chart_hours': {'labels': hour_labels, 'hits': hour_hits},
        'chart_pages': {
            'labels': [p for p, _ in top_pages][::-1],
            'hits': [c for _, c in top_pages][::-1],
        },
        'chart_countries': {
            'labels': [f'{country_flag(c)} {c}' for c, _ in top_countries],
            'hits': [n for _, n in top_countries],
        },
    }
