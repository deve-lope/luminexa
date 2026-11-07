"""Luminexa ops analytics — standalone service (not part of the customer/provider SPA)."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.templating import Jinja2Templates

from . import queries

APP_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(APP_DIR / 'templates'))

security = HTTPBasic(auto_error=False)

app = FastAPI(
    title='Luminexa Ops',
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def require_ops_auth(
    credentials: HTTPBasicCredentials | None = Depends(security),
) -> str:
    user = (os.environ.get('OPS_DASHBOARD_USER') or 'ops').strip()
    password = (os.environ.get('OPS_DASHBOARD_PASSWORD') or '').strip()
    if not password:
        # Local default — override via env in compose.
        password = 'luminexa-ops-local'
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Authentication required',
            headers={'WWW-Authenticate': 'Basic realm="Luminexa Ops"'},
        )
    user_ok = secrets.compare_digest(credentials.username, user)
    pass_ok = secrets.compare_digest(credentials.password, password)
    if not (user_ok and pass_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid credentials',
            headers={'WWW-Authenticate': 'Basic realm="Luminexa Ops"'},
        )
    return credentials.username


def _fmt_dt(value) -> str:
    if value is None:
        return '—'
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    return str(value)


def _fmt_day(value) -> str:
    if value is None:
        return '—'
    return str(value)


templates.env.filters['dt'] = _fmt_dt
templates.env.filters['day'] = _fmt_day


@app.get('/health')
def health():
    return {'ok': True}


@app.get('/', response_class=HTMLResponse)
def dashboard(request: Request, _user: str = Depends(require_ops_auth)):
    try:
        data = queries.dashboard_payload()
    except Exception as exc:  # noqa: BLE001 — surface DB errors in the UI
        return templates.TemplateResponse(
            request,
            'error.html',
            {'request': request, 'error': str(exc)},
            status_code=500,
        )
    return templates.TemplateResponse(
        request,
        'dashboard.html',
        {
            'request': request,
            'generated_at': datetime.now(timezone.utc),
            **data,
        },
    )
