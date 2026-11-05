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

## Page visits (analytics)

There is no always-on Google Analytics tag. Page-view scripts load only when you set the env vars below and rebuild the frontend image.

**Fastest (no rebuild):** Cloudflare Dashboard → Analytics & Logs → Web Analytics → Add a site for `app.luminex-a.com` → Automatic JavaScript injection. That dashboard shows top paths (including `/privacy`) and filters many bots. Do not also bake `REACT_APP_CF_BEACON_TOKEN` if you use automatic injection, or visits double-count.

**Optional in-repo tags** (empty = off):

| Variable | Dashboard |
|----------|-----------|
| `REACT_APP_CF_BEACON_TOKEN` | Cloudflare Web Analytics JS snippet token |
| `REACT_APP_GA_MEASUREMENT_ID` | Google Analytics 4 (`G-XXXX`) |

CRA bakes these into the frontend **at image build**. After setting them in `.env.docker.prod`:

```bash
docker compose --env-file .env.docker.prod up -d --build frontend
```

**Nginx access logs** (always on, no dashboard): `docker logs luminexa-frontend` uses a combined-style line with the Cloudflare visitor IP, `host=`, `country=`, request, referer, and User-Agent. Example:

```bash
docker logs luminexa-frontend --since 168h 2>&1 | tee /tmp/lx-nginx.log
grep -oE '"(GET|HEAD) [^"]+' /tmp/lx-nginx.log | awk '{print $2}' | sed 's/[?].*//' | sort | uniq -c | sort -nr | head
grep -E '"GET /privacy' /tmp/lx-nginx.log | awk -F'"' '{print $(NF-1)}' | sort | uniq -c | sort -nr | head
```

Templates live in `env/*.example` (safe to commit). Real env files are gitignored.
