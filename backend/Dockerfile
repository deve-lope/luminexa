FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && rm -rf /var/lib/apt/lists/*

COPY requirements-prod.txt /app/
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY . /app/

ENV DJANGO_SECRET_KEY=build-time-only-not-for-production
RUN python manage.py collectstatic --noinput

RUN mkdir -p /app/media /app/data && chmod -R 755 /app/media /app/data

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app
USER app

EXPOSE 9001

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:9001", "--workers", "2", "--timeout", "120", "luminexa.wsgi:application"]
