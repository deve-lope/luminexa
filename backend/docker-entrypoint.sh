#!/bin/sh
set -e
cd /app

# Wait for Postgres when DATABASE_URL points at it (SQLite needs no wait).
python - <<'PY'
import os
import time

url = (os.environ.get("DATABASE_URL") or "").strip()
if not url or not url.startswith(("postgres://", "postgresql://")):
    raise SystemExit(0)

import dj_database_url
import psycopg2

cfg = dj_database_url.parse(url)
deadline = time.time() + 60
last_err = None
while time.time() < deadline:
    try:
        conn = psycopg2.connect(
            dbname=cfg["NAME"],
            user=cfg["USER"],
            password=cfg["PASSWORD"],
            host=cfg["HOST"],
            port=cfg.get("PORT") or 5432,
        )
        conn.close()
        print("Postgres is ready.")
        raise SystemExit(0)
    except Exception as exc:  # noqa: BLE001
        last_err = exc
        time.sleep(1)

raise SystemExit(f"Postgres not ready after 60s: {last_err}")
PY

# Only the web container should migrate — celery shares this image/entrypoint
# and parallel migrate races on Postgres index creation.
if [ "${RUN_DB_MIGRATE:-0}" = "1" ]; then
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput 2>/dev/null || true
fi

exec "$@"
