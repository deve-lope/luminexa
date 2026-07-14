# Luminexa

Local service booking platform — built from scratch.

**Spec:** [`docs/LUMINEXA_PLATFORM_REPORT.md`](docs/LUMINEXA_PLATFORM_REPORT.md)

## Docker (recommended)

Use **separate env files** so dev/prod-local/native never mix. Details: [`env/README.md`](env/README.md).

```bash
cd luminexa
chmod +x scripts/docker-init-env.sh
./scripts/docker-init-env.sh   # creates .env.docker.prod + .env.docker.dev

# Prod-local stack — SPA :3000, API :9001
docker compose up -d --build

# Dev stack (optional, alongside prod-local) — SPA :3001, API :9002
docker compose -f docker-compose.dev.yml up -d --build
```

Create admin after first start:

```bash
docker compose exec web python manage.py createsuperuser
# dev stack: docker compose -f docker-compose.dev.yml exec web-dev python manage.py createsuperuser
```

| Stack | Compose file | Env file | SPA | API |
|-------|----------------|----------|-----|-----|
| Prod-local | `docker-compose.yml` | `.env.docker.prod` | http://localhost:3000 | http://localhost:9001 |
| Dev | `docker-compose.dev.yml` | `.env.docker.dev` | http://localhost:3001 | http://localhost:9002 |

**Container names:** `luminexa-web`, `luminexa-frontend`, `luminexa-web-dev`, `luminexa-frontend-dev` (not `home_auto-*`).

Stop Home_Auto if ports conflict:

```bash
cd ~/Home_Auto && docker compose stop web frontend
```

## Native (optional)

Only if you are not using Docker. Use `backend/.env` and `frontend/.env` — **not** `.env.docker.*`.

See [`env/native.example`](env/native.example).

## Project layout

```
luminexa/
  backend/           Django API
  frontend/          React SPA
  env/               Env templates (committed)
  docker-compose.yml
  docker-compose.dev.yml
  .env.docker.prod   # gitignored — prod-local Docker
  .env.docker.dev    # gitignored — dev Docker
```

## Roadmap

`businesses` and `jobs` apps, provider dashboard — see platform report.
