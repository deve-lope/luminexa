"""Lightweight request watching: probe signatures, 429s, and 5xx spikes."""

from __future__ import annotations

import re
import urllib.parse

from accounts.owner_alerts import record_probe, record_rate_limit_hit, record_server_error

# Signatures chosen to avoid matching normal Luminexa paths (/book/, /customer/, ...).
_SQL_RE = re.compile(
    r"(?i)(?:union\s+select|information_schema|sleep\s*\(|or\s+1\s*=\s*1|"
    r"';?\s*drop\s+table|xp_cmdshell|load_file\s*\()"
)
_TRAVERSAL_RE = re.compile(r'(?i)(?:\.\./|\.\.\\|/etc/passwd|/proc/self|%2e%2e%2f|%00)')
_SCANNER_RE = re.compile(
    r'(?i)(?:wp-admin|wp-login|phpmyadmin|/vendor/phpunit|\.env(?:\.|$)|'
    r'xmlrpc\.php|/\.git/)'
)

_SKIP_PREFIXES = (
    '/static/',
    '/media/',
    '/icons/',
    '/images/',
)


def classify_suspicious(path: str, query: str) -> str | None:
    haystack = f'{path}?{urllib.parse.unquote_plus(query or "")}'
    if _SQL_RE.search(haystack):
        return 'sql_injection'
    if _TRAVERSAL_RE.search(haystack):
        return 'path_traversal'
    if _SCANNER_RE.search(path):
        return 'scanner_path'
    return None


class SecurityWatchMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path or ''
        if not path.startswith(_SKIP_PREFIXES):
            reason = classify_suspicious(path, request.META.get('QUERY_STRING', ''))
            if reason:
                record_probe(request, reason)

        try:
            response = self.get_response(request)
        except Exception:
            record_server_error(request, 500)
            raise

        status = getattr(response, 'status_code', 0) or 0
        if status >= 500:
            record_server_error(request, status)
        elif status == 429:
            record_rate_limit_hit(request, scope='http-429')
        return response
