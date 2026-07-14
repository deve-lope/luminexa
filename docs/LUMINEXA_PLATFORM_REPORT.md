# Luminexa — Platform handoff & greenfield specification

**Version:** 1.1  
**Date:** 2026-05-06  
**Purpose:** Upload to a new Cursor chat/repo and build **Luminexa** without inheriting `Home_Auto` database or broken migration history.

---

## 1. Executive summary

**Luminexa** is a **local service booking platform**: customers book services; businesses manage jobs, prep **tasks**, and **checklists** on a mobile-first provider dashboard.

The prior codebase lived under **`Home_Auto`**. App renames (`users`→`accounts`, etc.) left **SQLite table names** out of sync and caused login **500** errors.  

**Greenfield rule:** new repo, fresh `migrate`, **do not copy** `Home_Auto/db.sqlite3`.

---

## 2. Local development ports (use these on the new project)

Match **Home_Auto** so you can run Luminexa on the **same ports** you already use (and run prod + dev side by side if needed).

### 2.1 Port map

| Service | URL (localhost) | Port | When to use |
|---------|-----------------|------|-------------|
| **React SPA** | `http://localhost:3000` | **3000** | Production-style local stack, or `npm start` default |
| **Django API + admin** | `http://localhost:9001` | **9001** | API, `/admin/`, media in dev |
| **React SPA (dev stack)** | `http://localhost:3001` | **3001** | Docker dev compose or second CRA instance |
| **Django API (dev stack)** | `http://localhost:9002` | **9002** | Docker dev compose (`runserver` inside container still listens on 9001; host maps **9002→9001**) |

**Both stacks can run at once** — production-local uses **3000/9001**, dev uses **3001/9002** (no port clash).

### 2.2 Environment variables (copy into `.env` / `.env.example`)

**Frontend (`frontend/.env` or CRA env):**

```bash
# Default local API (production-style ports)
REACT_APP_API_URL=http://localhost:9001

# Dev stack only (when SPA runs on 3001 and API on 9002)
# REACT_APP_API_URL=http://127.0.0.1:9002
```

**Backend (Django / `decouple` or `.env`):**

```bash
# Bind runserver to all interfaces if testing from phone on LAN
# python manage.py runserver 0.0.0.0:9001

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001

# Optional: absolute links in invite emails / join URLs
PUBLIC_APP_URL=http://localhost:3000
```

Adjust `CORS_ALLOWED_ORIGINS` with your LAN IP if you test from another device (e.g. `http://192.168.x.x:3000` — same pattern as Home_Auto `settings.py`).

### 2.3 How to start (greenfield, no Docker yet)

```bash
# Terminal 1 — Django (port 9001)
cd backend   # or project root with manage.py
python manage.py runserver 0.0.0.0:9001

# Terminal 2 — React (port 3000)
cd frontend
# Optional explicit port (CRA defaults to 3000):
PORT=3000 npm start
```

**Django admin:** `http://localhost:9001/admin/`  
**SPA:** `http://localhost:3000/`  
**Login API:** `POST http://localhost:9001/accounts/api/login/`

### 2.4 Docker (optional — same as Home_Auto)

If you reuse the Home_Auto pattern:

| Compose file | Frontend host port | Backend host port |
|--------------|-------------------|-------------------|
| `docker-compose.yml` (prod-local) | **3000** → container 80 | **9001** → 9001 |
| `docker-compose.dev.yml` (dev) | **3001** → 3000 | **9002** → 9001 |

Dev compose sets `REACT_APP_API_URL=${DEV_API_URL:-http://127.0.0.1:9002}` and `WDS_SOCKET_PORT=3001`.

### 2.5 Cloudflare / production tunnel (reference)

Home_Auto tunnels **public** traffic to localhost **3000** (SPA) and **9001** (API). Greenfield production should keep the same host ports unless you change tunnel config.

---

## 3. Product vision

| Actor | Goals |
|--------|--------|
| **Customer** | Find services, book slots, track activity. |
| **Business (owner/staff)** | Public profile, **morning board**: jobs, **tasks**, **checklist**, tick-done, create tasks from SPA. |
| **Platform staff** | Django admin at **`{REACT_APP_API_URL}/admin/`** — not main SPA. |

**Tagline:** *Book local services. Effortlessly.*

---

## 4. Brand & UI (landing + login)

### Palette

| Token | Hex | Usage |
|--------|-----|--------|
| Navy | `#0F172A` | Page background |
| Accent | `#7C3AED` | Primary buttons, focus |
| Mist | `#F8FAFC` | Text on dark |
| Slate | `#1E293B` | Cards |

**Effects:** violet radial glows, subtle CSS grid, glass panels, Framer Motion fade-up. **No stock photos.**

### Layout

- **`/`** and **`/login`**: full dark marketing/auth shell; **hide** global light Navbar/Footer (route-group or `useLocation` in `App.js`).
- **In-app** (`/customer`, `/provider`, …): app shell with nav (can stay light gray initially).

### CTAs

- Marketing → **`/register`** and **`/login`**.
- Post-login: **`postLoginRoute.js`** — staff → Django admin; owner/staff → `/provider`; else → `/customer`. **Do not change** without product sign-off.

---

## 5. Authentication

| Item | Value |
|------|--------|
| SPA auth | DRF **Token** — `Authorization: Token <key>` |
| Login | `POST /accounts/api/login/` — `{ email, password }` |
| Register | `POST /accounts/api/register/` |
| Logout | `POST /accounts/api/logout/` |
| Profile | `GET/PUT /accounts/api/profile/` |
| Memberships | `GET /api/v1/me/memberships/` |

**User model:** `accounts.User`, `USERNAME_FIELD = email`, `full_name` required.

**Greenfield:** apps named **`accounts`**, **`businesses`**, **`jobs`** from day one — never ship `users` / `tenants` / `bookings` labels.

---

## 6. Domain model (summary)

- **Organization**, **OrganizationMembership** (owner / staff / customer), **OrganizationInvitation**
- **Service**, **Booking** (job), **ServiceRecord**
- **Task** (optional job FK, priority, `is_done`)
- **ChecklistItem** (kind: carry / before / other, optional job FK)
- **GET** `/api/v1/public/providers/<slug>/` for `/book/:slug`
- **GET** `/api/v1/provider-dashboard/?organization=<slug>` — upcoming jobs, open tasks, open checklist

---

## 7. Frontend reference paths (Home_Auto)

| Topic | Path |
|--------|------|
| Landing | `frontend/src/pages/LuminexaLandingPage.js` |
| Login | `frontend/src/pages/LoginPage.js` |
| API base URL | `frontend/src/utils/api.js` → `REACT_APP_API_URL` default **`http://localhost:9001`** |
| Admin redirect | `frontend/src/utils/djangoAdmin.js` |
| Auth | `frontend/src/contexts/AuthContext.js` |
| Provider dashboard | `frontend/src/pages/ProviderDashboardPage.js` |
| Post-login | `frontend/src/utils/postLoginRoute.js` |
| Hide nav on `/` + `/login` | `frontend/src/App.js` |

---

## 8. Suggested repo layout

```
luminexa/
  backend/          # manage.py, luminexa/settings, accounts, businesses, jobs
  frontend/         # CRA React
  docs/
    LUMINEXA_PLATFORM_REPORT.md
  .env.example      # ports 3000 / 9001 documented
  README.md
```

---

## 9. Day 0 checklist

- [ ] New git repo; `.gitignore` venv, `node_modules`, `.env`, `db.sqlite3`
- [ ] Django apps: `accounts`, `businesses`, `jobs`; `AUTH_USER_MODEL = 'accounts.User'`
- [ ] `migrate` on **empty** DB; `createsuperuser`
- [ ] Confirm **`http://localhost:9001/accounts/api/login/`** returns 200 + token
- [ ] SPA on **`http://localhost:3000`** with `REACT_APP_API_URL=http://localhost:9001`
- [ ] Port landing + login UI; provider dashboard when API ready

---

## 10. What not to copy from Home_Auto

- `db.sqlite3`
- Old migration files without review
- Renamed-app table mismatch (`users_user` vs `accounts_user`)

---

*End of handoff — v1.1 adds explicit **ports 3000 / 9001** (local prod-style) and **3001 / 9002** (dev stack) aligned with Home_Auto.*
