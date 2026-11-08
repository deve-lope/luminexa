"""Read-only Postgres access for the ops dashboard."""

from __future__ import annotations

import os
from contextlib import contextmanager
from urllib.parse import urlparse, unquote

import psycopg
from psycopg.rows import dict_row


def _conninfo() -> str:
    url = (os.environ.get('DATABASE_URL') or '').strip()
    if not url:
        raise RuntimeError('DATABASE_URL is required')
    # Django-style postgres:// → psycopg postgresql://
    if url.startswith('postgres://'):
        url = 'postgresql://' + url[len('postgres://') :]
    parsed = urlparse(url)
    user = unquote(parsed.username or '')
    password = unquote(parsed.password or '')
    host = parsed.hostname or 'db'
    port = parsed.port or 5432
    dbname = (parsed.path or '/').lstrip('/') or 'postgres'
    return (
        f'host={host} port={port} dbname={dbname} '
        f'user={user} password={password} connect_timeout=5'
    )


@contextmanager
def get_conn():
    conn = psycopg.connect(_conninfo(), row_factory=dict_row)
    try:
        yield conn
    finally:
        conn.close()


def fetch_all(sql: str, params: tuple | dict | None = None) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            return list(cur.fetchall())


def fetch_one(sql: str, params: tuple | dict | None = None) -> dict | None:
    rows = fetch_all(sql, params)
    return rows[0] if rows else None
