# Luminexa Ops Dashboard

Standalone analytics UI — **not** part of the customer/provider webapp.

Reads the Luminexa Postgres database (same `DATABASE_URL` as Docker) and shows signups, businesses, bookings, push devices, and login activity.

## Run locally (Docker)

Main stack DB must be up:

```bash
docker compose up -d db
docker compose -f docker-compose.ops.yml up -d --build
```

Open **http://127.0.0.1:3050/** or **http://&lt;tailscale-ip&gt;:3050/**

- User: `ops`
- Password: `luminexa-ops-local`

Change credentials via `OPS_DASHBOARD_*` in [`docker-compose.ops.yml`](../docker-compose.ops.yml).

Stop:

```bash
docker compose -f docker-compose.ops.yml down
```

## Notes

- Published on port **3050** (reachable via Tailscale / LAN). Prefer Tailscale ACLs; keep Basic auth on.
- Does not modify or deploy with the main SPA.
- Website traffic comes from the frontend nginx access log volume (`luminexa_luminexa_nginx_logs`).
- App Store / Play download counts are still only in Connect / Play Console.
