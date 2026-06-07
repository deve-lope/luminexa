#!/bin/sh
set -e
cd /app
python manage.py migrate --noinput
# Ensure admin assets exist if volume wiped collectstatic from image
python manage.py collectstatic --noinput 2>/dev/null || true
exec "$@"
