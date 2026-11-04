# Luminexa environment files

**Rule:** each runtime uses its own env file. Do not share one `.env` between Docker and native.

| File (repo root) | Used by | Ports |
|------------------|---------|-------|
| `.env.docker.prod` | `docker compose up` | SPA **3000**, API **9001** |
| `.env.docker.dev` | `docker compose -f docker-compose.dev.yml up` | SPA **3001**, API **9002** |
| `backend/.env` + `frontend/.env` | Native `runserver` / `npm start` only | **3000** / **9001** |

## First-time setup

```bash
cd /path/to/luminexa
cp env/docker.prod-local.example .env.docker.prod
cp env/docker.dev.example .env.docker.dev
```

Edit secrets in `.env.docker.prod` before any real deployment.

`OWNER_ALERT_EMAIL` is optional. When set, Django emails that address (via the same `EMAIL_*` SMTP/Brevo/Mailpit settings) on each new account and on throttled security events. Leave it blank to disable.

Templates live in `env/*.example` (safe to commit). Real env files are gitignored.
