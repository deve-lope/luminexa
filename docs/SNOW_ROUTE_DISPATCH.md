# Snow route dispatch — build guide for agents

**Status:** approved scope, not built yet. This file is the **source of truth** for the snow module. It supersedes the earlier chat plan (`snow_route_dispatch_*.plan.md`) wherever they disagree.

Read first: [`AGENTS.md`](../AGENTS.md), [`docs/AGENT_PLAYBOOK.md`](AGENT_PLAYBOOK.md), [`docs/PRODUCT_RULES.md`](PRODUCT_RULES.md). Everything here is **additive**. Appointment providers must not notice any change.

---

## 1. What we are building (one paragraph)

A snow-clearing mode for provider orgs. The owner (the **master** / dispatcher) keeps a list of customer **properties** grouped into **regions**. Each property has a contract: seasonal, monthly, or one-time. When snow is forecast above the org's threshold, the master is alerted. They then create a **run** for a region, pick crews, add the seasonal group, and add one-time stops one by one while seeing the extra time each costs. Next they **optimize**, which splits the stops across the crews and orders them, and **commit**. Each crew member opens the app, taps **Start**, follows the next stop through Google/Apple Maps, can add up to 2 proof photos, and taps **Done**. The master watches progress and GPS live. Customers get notified when the run is scheduled, about 30 minutes before the crew arrives, and when their stop is done.

## 2. Scope

**In (v1):** everything in §5 milestones M0–M7.

**Out (do not build):**

- Social bidding marketplace
- Lawn or other modules
- GraphHopper, OSRM, or Google Distance Matrix
- Background GPS
- Auto-starting runs without a human (the master always confirms)
- A separate `dispatch` staff role (the master is the org owner)
- A `hybrid` provider mode

## 3. Compatibility review: decisions forced by the existing code

The plan was checked against the current codebase. These are binding:

| # | Existing behavior | Risk if ignored | Decision |
|---|---|---|---|
| C1 | `provider_book_customer` creates `REQUESTED` + `awaiting_customer_acceptance` bookings, always attaches or creates an `AvailabilitySlot`, and the view emails an invite | Every seasonal stop would email the customer an invite and fill the calendar with fake slots | **Never** use `provider_book_customer` or `notify_customer_provider_direct` for dispatch |
| C2 | Celery scanners (`send_upcoming_booking_reminders`, `send_provider_job_nudges`, rate reminders) fire for **all** CONFIRMED/COMPLETED bookings, with no source filter | 40 seasonal bookings per storm would spam 1h, 30m, and overdue nudges plus 24h reminders | **Seasonal and monthly stops do not create `Booking` rows.** `DispatchRunStop` is the job record for route work. Their billing is the contract, not per job |
| C3 | Customer-booked one-time jobs are real `Booking`s with a slot time | Once added to a run, the slot time is wrong and the nudges are misleading | Link them via `DispatchRunStop.booking`. Exclude bookings linked to a non-cancelled run from `send_provider_job_nudges` and `send_upcoming_booking_reminders` (small filter plus tests) |
| C4 | `complete_booking` enforces "6h before start" (`_require_job_action_window`). The complete **API** always invoices and calls `notify_booking_completed` | Crew could not finish a 3pm booking at 8am, and seasonal stops must not be invoiced | New `dispatch_services.complete_stop()`. **One-time:** mark the linked booking COMPLETED without the window check, then call the existing `issue_or_update_invoice` and `notify_booking_completed` (that email is the "Done" email). **Walk-in one-time** (no booking): create a `Booking(source=dispatch_run, status=completed, availability_slot=None, start_at/end_at = actual times)`, then invoice and notify. **Seasonal/monthly:** new snow "Done" email plus in-app notification, no invoice |
| C5 | `is_org_staff` and ~22 `role__in=(OWNER, STAFF)` checks gate all provider APIs | Making crew a "staff" would expose bookings, clients, invoices, and prices | New `OrganizationMembership.Role.CREW`, which **fails closed**: existing checks reject it. Add `is_org_crew()` and `is_provider_member()` helpers. **Do not widen `is_org_staff`** |
| C6 | `MAX_STAFF_PER_ORGANIZATION = 3`. `StaffInvitation` has no role, and accepting always assigns STAFF | Seat logic and invites would mix up | Add `StaffInvitation.role` (default `staff`). Accepting assigns that role. Crew seats are a **separate pool** (§4.4). The staff cap is unchanged |
| C7 | Stripe checkout always uses quantity 1. `org_has_active_subscription` checks status only (plan-agnostic) | Extra crew seats cannot be billed | Add plan `snow_monthly` with a base price item plus an extra-seat price item (quantity). Gating keeps working because it is status-based |
| C8 | The native app hides all purchase CTAs (`isNativeApp()`, storeShell) | Play policy violation | Snow billing and seat purchase are **web only**, same as Pro |
| C9 | `/media/` is served publicly by `serve_media` | Proof photos of homes would be guessable public URLs | Store photos **outside** `MEDIA_ROOT` (e.g. `PRIVATE_MEDIA_ROOT/dispatch_proof/`) and serve them through an authenticated view |
| C10 | `geocode.py` (Photon first, Nominatim fallback) has no throttle | Bulk import would get the server IP-banned | Single add geocodes inline. CSV import geocodes in a Celery task at **≤1 request/second** |
| C11 | Open-Meteo **free API is non-commercial only** (Luminexa has subscriptions, so it counts as commercial) | Terms violation once orgs pay | Weather goes behind an adapter. Dev and beta may use the free endpoint. **Before charging snow orgs**, set `OPEN_METEO_API_KEY` (paid "API Standard", customer-api host) |
| C12 | Google Maps URLs allow about 3 waypoints in mobile browsers and 9 elsewhere | Full-route links get truncated | Navigation is **per next stop** (destination only). Reuse the URL helpers in `ServiceAddressBlock.js` |
| C13 | `@capacitor/geolocation` is foreground only. Background location needs a Play policy declaration | Play rejection | GPS pings only while the crew run screen is open. Show a "Keep app open while driving" banner |
| C14 | gunicorn runs 2 workers with a 120s timeout | A long solve blocks half the API | Solver hard time limit is **5s**, with a cap of **120 stops per run** (v1). Solve synchronously in the request. Move to Celery only if real orgs exceed this |
| C15 | Capacity (`concurrent_capacity`, slot FK) and dual-radius search | High-risk modules | **Do not touch.** Regions are not `OrganizationLocation`s and do not affect discovery |

Untouched: `backend/businesses/location.py`, the capacity helpers, discover APIs, and the customer Find / Home / Browse pages.

## 4. Design

### 4.1 Org mode and settings (`businesses`)

Add to `Organization` (migration `businesses.0029_…`):

- `provider_mode`: `appointment` (default, all existing orgs) | `property_routes`
- `route_vertical`: `''` | `snow` (only option for now)
- `snow_threshold_cm` (Decimal, default 2.0)
- `snow_plow_speed_kmh` (default 30)
- `snow_road_factor` (default 1.3, the straight-line → road distance multiplier)
- `snow_duration_matrix` (JSON, seeded, see §4.3)
- `snow_late_start_alert_enabled` (default False), `snow_late_start_alert_minutes` (default 30)
- `snow_extra_crew_seats` (int, default 0; synced from Stripe)

Entry points:

- **Signup:** the provider setup step asks "Need route / custom optimization?" with Yes/No. **Yes** shows a dropdown containing only "Snow cleaning". **No** gives `appointment`.
- **Settings:** an owner-only "Route optimization" card can switch modes. Switching back to `appointment` hides snow UI but **keeps the data**.
- Turning on snow seeds: one region "Main", the duration matrix, and 4 catalog services (Roadside / Driveway / Front / Full). The services are used only for one-time invoices; the provider sets the prices.

### 4.2 Roles

- `OrganizationMembership.Role.CREW = 'crew'` (choices AlterField migration).
- Helpers in `backend/jobs/permissions.py`:
  - `is_org_crew(user, org)`
  - `is_provider_member(user, org)` (owner/staff/crew)
  - `require_snow_org(org)` (`provider_mode == property_routes`)
- Crew may only call **crew endpoints** (§4.6). Crew serializers contain **no prices, invoice data, contract or payment fields, customer email/phone, or other crews' stops**.
- Frontend:
  - Include `crew` wherever the "provider member" list is built: `isProviderMember`, `ProviderLayout.js` providerOrgs filter, `postLoginRoute.js`.
  - Crew are redirected to the crew home and blocked from every other `/provider/*` route.
  - Crew never see the subscribe page. If the org is unsubscribed, they get "Ask your manager to renew".

### 4.3 Data model (`jobs`, migrations from `jobs.0062_…`)

**`ServiceRegion`**

- organization, name (unique per org), is_active
- depot_latitude/longitude (nullable; fall back to the org primary pin)
- created_at

**`ServiceProperty`** (one per address)

- organization, region (FK, required), customer (FK User; the customer must have an org Clients membership)
- Address fields matching `Booking.service_*` (line1, line2, city, region, postal, country), latitude/longitude, geocoded_at
- house_type: `detached | townhouse | duplex | shared_driveway | commercial | other`
- work_type: `roadside | driveway | front | full`
- service_minutes_override (nullable)
- frequency: `seasonal | monthly | one_time`
- contract_start, contract_end (dates; required unless `one_time`)
- payment_status: `unpaid | paid`, payment_method: `'' | cash | card | etransfer | other`, paid_at, contract_amount (optional, owner-only)
- notes (gate code etc., visible to crew), is_active

**Derived contract status** (in the org timezone, not stored):

- `upcoming`: start > today
- `live`: start ≤ today ≤ end, and end > today + 7
- `expiring`: within 7 days of the end
- `expired`: end < today

`one_time` properties are always `live` until they are used in a completed run.

**Optimize includes `live` + `expiring`.** It excludes `expired` and `upcoming`. **Unpaid live contracts are still routed**; they only get a badge.

**Duration matrix** (minutes; seeded, owner-editable; validate 1–240):

| work_type \\ house_type | detached | townhouse | duplex | shared_driveway | commercial | other |
|---|---|---|---|---|---|---|
| roadside | 5 | 5 | 5 | 5 | 10 | 5 |
| driveway | 10 | 10 | 12 | 15 | 30 | 10 |
| front | 15 | 15 | 18 | 20 | 40 | 15 |
| full | 20 | 20 | 25 | 30 | 60 | 20 |

Service minutes for a stop = property override, otherwise the matrix value.

**`DispatchRun`**

- organization, region, run_date, scheduled_start (aware datetime), forecast_snow_cm (nullable)
- status: `draft | scheduled | in_progress | completed | cancelled`
- created_by, solver_meta (JSON: solver used, solve ms, total minutes), committed_at, created_at

**`DispatchRoute`** (one per crew in a run)

- run, crew_membership (FK `OrganizationMembership`, role crew or owner), vehicle_index
- status: `not_started | in_progress | done`, started_at, completed_at
- last_latitude, last_longitude, last_ping_at (latest point only; no history in v1)
- Sentinels: crew_scheduled_sent_at, crew_1h_sent_at, late_start_alert_sent_at

**`DispatchRunStop`**

- run, route (nullable until optimized), sequence
- property (nullable FK), booking (nullable FK; one-time customer bookings), customer (FK User)
- kind: `seasonal | monthly | one_time`, work_type, house_type, service_minutes
- **Snapshot** of address + lat/lng at commit, so later edits don't rewrite history
- eta_at, status: `pending | done | skipped`, done_at, done_by, skip_reason
- customer_view_token (unique, for the public status page)
- Sentinels: customer_scheduled_sent_at, customer_soon_sent_at, customer_done_sent_at
- Constraints: unique (run, property) when property is set; unique (run, booking) when booking is set

**`DispatchStopPhoto`**

- stop, organization, uploaded_by, file path (private storage), size_bytes, created_at
- Max 2 per stop, ≤ 2 MB after client-side compression (JPEG, long edge ≤ 1600 px)
- Org quota: **200 photos**
- Celery beat deletes the file **and** the row after **3 days**

`Booking.Source` gains `DISPATCH_RUN = 'dispatch_run'` (AlterField), used only for walk-in one-time completions (C4).

### 4.4 Billing and seats

- Plan: `subscription_plan = 'snow_monthly'`. **$40 CAD/month includes 1 master + 3 crew seats**, plus **$15 CAD/month per extra crew seat** (a Stripe subscription item with quantity).
- Settings: `STRIPE_PRICE_SNOW_MONTHLY`, `STRIPE_PRICE_SNOW_EXTRA_CREW`.
- Webhooks sync `snow_extra_crew_seats` from the item quantity.
- The snow plan **includes all Pro features** (it replaces Pro; it is not stacked on top). Switching Pro ↔ Snow is a subscription price swap in owner billing settings on the web.
- Seat rules:
  - Crew seats allowed = 3 + `snow_extra_crew_seats`.
  - Seats used = crew memberships + **pending** crew invites.
  - The master never uses a seat.
  - Extra seats require an active paid subscription (trial = 3 crew).
  - Removing a seat below current usage is blocked until a crew member is removed.
- Invites go **by email only**, reusing `StaffInvitation` + `staff_invite_views.py` with `role=crew`.

### 4.5 Optimizer (`backend/jobs/dispatch_optimizer.py`, pure function, no ORM)

```text
solve(depot, stops[{id, lat, lng, service_min}], vehicles=N, speed_kmh, road_factor, time_limit_s=5)
  -> routes[[stop_id...] per vehicle], per-stop arrival offsets (min), totals
```

- Matrix: `haversine_km × road_factor / speed_kmh` → seconds (integers).
- OR-Tools `RoutingModel`:
  - Transit callback = travel + service time at the from-node.
  - Time dimension with **global span cost** so work is **balanced across crews** (otherwise one truck takes everything).
  - First solution `PATH_CHEAPEST_ARC`, then `GUIDED_LOCAL_SEARCH` with the time limit.
- Routes are open-ended: crews do not have to return to the depot.
- Fallback when `ortools` import fails or no solution is found: angular sweep into N clusters, then nearest-neighbour inside each. Record `solver_meta.solver = 'fallback'`.
- **One-time cost preview:**
  - Per candidate: `solo_detour_min` = best insertion cost into the current seasonal-only solution (travel delta + service minutes).
  - Selection summary: total minutes and per-crew finish times for the current selection, re-solved on toggle (debounced).
- Stops without coordinates block optimization and are listed as "Fix address".
- ETAs: `scheduled_start + offset`. On each Done, remaining ETAs on that route shift by the actual delay.
- Add `ortools` to `backend/requirements.txt` **and** `requirements-prod.txt` (it installs on python:3.12-slim). Rebuild Docker.

### 4.6 API (`backend/jobs/dispatch_views.py`, mounted in `jobs/urls.py`; all paths under the existing org prefix + `dispatch/`)

All endpoints require `require_snow_org` + an active subscription.

**Owner (master) only:**

- `settings/` GET/PATCH: threshold, speed, road factor, matrix, late-start alert, depot
- `regions/` CRUD
- `properties/` CRUD, filters `region, frequency, status, payment_status, q`; `properties/import/` (CSV → Celery)
- `crew/`: list, seats, invite (`role=crew`), remove
- `runs/` list + create draft
- `runs/{id}/`: detail; PATCH (crews, scheduled_start)
- `runs/{id}/candidates/`: one-time candidates + `solo_detour_min`
- `runs/{id}/optimize/`: preview only, writes nothing except to the draft
- `runs/{id}/commit/`: status → `scheduled`, freeze snapshots, send scheduled notifications
- `runs/{id}/reorder/`, `runs/{id}/cancel/`
- `runs/{id}/live/`: per-route progress %, overall %, last GPS, ETAs
- `photos/` list (filter date) + bulk delete (ids, or all for a date)
- `weather/week/`: 7 days of `snowfall_cm` + `over_threshold`

**Crew (own route only; 404 for other routes):**

- `my-routes/`: today's and upcoming assigned routes
- `routes/{id}/start/`, `routes/{id}/location/` (lat, lng; throttle ≥ 60s server-side)
- `stops/{id}/done/`, `stops/{id}/skip/` (reason), `stops/{id}/photos/` POST (max 2)
- The crew stop payload contains: address, work_type, house_type, notes, customer first name, maps lat/lng, sequence, status. **No prices.**

**Public:**

- `GET /api/v1/public/snow-stops/{token}/` returns the stop status and ETA.
- Crew `lat/lng` + km are included **only if** the route is in progress, the stop is pending, and the crew is **≤ 5 km** away. Otherwise `crew_location: null`.

### 4.7 Notifications (Celery beat `send_dispatch_nudges` every 5 min + immediate on commit/done)

New `ProviderNotification.Kind` and `CustomerNotification.Kind` values need AlterField migrations (pattern: `jobs.0053`, `jobs.0060`). Push goes through the existing push helpers. Email uses the existing email helpers and templates.

| Who | When | Channel | Sentinel |
|---|---|---|---|
| Master | Forecast day ≥ threshold (once per org per date) | email + push + in-app | `StormAlert(org, date)` row |
| Crew | Run committed | email + push + in-app | `route.crew_scheduled_sent_at` |
| Crew | 1h before `scheduled_start` | push + in-app | `route.crew_1h_sent_at` |
| Master | Route not started by start + N min (only if enabled) | push + in-app | `route.late_start_alert_sent_at` |
| Customer | Run committed (with forecast cm, ETA window) | email + in-app (+ push if app) | `stop.customer_scheduled_sent_at` |
| Customer | About 30 min before ETA (route in progress) | in-app + push | `stop.customer_soon_sent_at` |
| Customer | Stop Done | email + in-app | `stop.customer_done_sent_at` |

Customer emails link to `/snow/{token}` (the public status page; works without the app). Crew messages never include prices.

### 4.8 Weather (`backend/jobs/weather.py`)

- Adapter `get_daily_snowfall_cm(lat, lng, days=7, tz)` → `[{date, snowfall_cm}]`, using Open-Meteo `daily=snowfall_sum` (cm).
- Uses the free host when there is no key, and the `customer-api` host + `apikey` when `OPEN_METEO_API_KEY` is set (C11).
- Cache per rounded lat/lng (2 decimals) for 3h in the Django cache.
- Beat task 3×/day evaluates snow orgs (depot = first active region depot, else org pin) and creates storm alerts. **It never creates or starts runs.**

### 4.9 Frontend (`frontend/src/pages/provider/routes/`, mobile-first, same Tailwind look and components as the existing provider pages)

**Nav** (`frontend/src/config/navigation.js`, branch by mode + role):

- Snow owner: **Today · Runs · Properties · Crew · More**
- Crew: **My run** only
- Appointment orgs: unchanged

**Pages:**

- `DispatchHomePage`: replaces `ProviderTodayPage` as the index for snow owners. Shows the 7-day snow strip (cm vs threshold, highlighted days), upcoming run cards (distinct style), and upcoming single bookings (reuse the existing upcoming list).
- `PropertiesPage` + `PropertyForm`: filter chips Live / Expiring / Expired / Upcoming / Unpaid, region filter, payment toggle (paid/cash + paid date).
- `RegionsSettings`, `RouteTimesSettings` (matrix editor), `SnowSettingsCard` (threshold, late-start alert).
- `CrewPage`: seats "2 of 3 used", invite by email, pending invites, remove, "Add seats ($15/mo)" (web only; hidden in native).
- `RunWizardPage`:
  1. Region + date + start time + crews
  2. Seasonal group as **one toggle** ("42 seasonal properties · 6h 10m")
  3. One-time stops **individually**, with `+N min` each and a live selection summary
  4. Optimize, then a per-crew list + Leaflet map
  5. Commit
- `RunLivePage`: overall % + per-crew %, last GPS dots (Leaflet), stop list with status and photos.
- `CrewRunPage`: Start → progress % → next stop card (address, work type, house type, notes, **Navigate** button for Google/Apple) → optional photos (2) → **Done** / Skip. Pings location every **120s** while open.
- `PhotosPage`: grid by date, select / select all for a date, delete.
- `SnowStopStatusPage` (public `/snow/:token`): status, ETA, crew distance/map only when ≤ 5 km.

## 5. Build milestones (do in order; each is shippable, only affects `property_routes` orgs)

Every milestone must:

- Add the tests listed
- Keep `cd backend && .venv/bin/python manage.py test` green
- Rebuild Docker (`docker compose up -d --build`)
- Remind the user to hard-refresh

**M0 — Foundation**

- Work:
  - Org fields and modes
  - `Role.CREW` + helpers
  - `StaffInvitation.role`
  - Signup question and Settings opt-in
  - Snow seeding (region, matrix, services)
  - Nav/route guards for crew
- Tests:
  - Appointment orgs unchanged (nav, index, existing suites)
  - Crew is 403 on bookings, clients, invoices, and analytics
  - Accepting a crew invite gives role crew
  - Staff cap is unchanged for appointment orgs

**M1 — Billing and seats**

- Work:
  - `snow_monthly` checkout with base + seat quantity
  - Webhook sync
  - Seat enforcement on invite
  - Native CTA hiding
- Tests:
  - 4th crew blocked without extra seats
  - Pending invites count
  - Master not counted
  - Quantity sync from webhook payload

**M2 — Properties and regions**

- Work:
  - Models, CRUD, contract status, payment tracking
  - Geocode on save
  - Properties UI + filters
  - CSV import task (throttled)
- Tests:
  - Status boundaries (7-day expiring, org timezone)
  - Expired excluded from the optimize candidate set
  - Region scoping per org
  - Geocode throttle

**M3 — Optimize and commit**

- Work:
  - Optimizer + fallback
  - Candidates/preview
  - Wizard UI
  - Commit with snapshots
  - Dispatch home with run cards
- Tests:
  - N crews balanced
  - Durations respected
  - Missing coordinates blocked
  - 120-stop cap
  - Fallback path
  - **Commit creates zero `Booking`s for seasonal stops and sends no appointment notifications**
  - Linked one-time booking excluded from provider nudges and 24h reminders

**M4 — Crew day-of**

- Work:
  - Crew run page, start/done/skip
  - ETA shift
  - One-time completion → booking completed + invoice + existing completion email
  - Seasonal Done email
- Tests:
  - Crew sees only own route and no prices
  - One-time done outside the 6h window works
  - Walk-in creates a `dispatch_run` booking + invoice
  - Seasonal done creates no invoice
  - Run auto-completes when all routes are done

**M5 — Notifications**

- Work: `send_dispatch_nudges` + all rows in §4.7
- Tests:
  - Every sentinel fires once
  - Late-start only when enabled
  - Cancelled runs are silent

**M6 — GPS**

- Work:
  - Location endpoint + throttle
  - Live map
  - Public token page with the 5 km gate
- Tests:
  - > 5 km returns null location
  - Done/skipped returns null
  - Wrong crew gets 404

**M7 — Weather and photos**

- Work:
  - Weather adapter + week strip + storm alerts
  - Private photo storage, limits, quota, 3-day sweep, bulk delete
- Tests:
  - Threshold comparison
  - Alert once per date
  - 3rd photo rejected
  - Oversize rejected
  - Quota enforced
  - Sweep deletes the file and the row
  - Photo URL requires auth

**Later (not v1):**

- Customer self-entered house type at one-time booking
- GraphHopper self-host matrix (swap only the matrix function)
- GPS history
- Multi-contract history per property

## 6. Files you will touch (and must not)

**Add:**

- `backend/jobs/dispatch_models.py` (imported in `jobs/models.py`) or append to `models.py`, matching the repo's existing pattern
- `dispatch_optimizer.py`, `dispatch_services.py`, `dispatch_views.py`, `dispatch_serializers.py`, `weather.py`
- Tasks in `jobs/tasks.py`, beat entries in `luminexa/settings.py`
- Tests `jobs/tests/test_dispatch_*.py`
- Frontend pages above

**Small edits allowed:**

- `businesses/models.py` (fields, role, invite role)
- `staff_invite_views.py`, `jobs/views.py` `invite_staff` (role param)
- `jobs/permissions.py` (new helpers only)
- `jobs/tasks.py` (exclude dispatch-linked bookings in 2 scanners)
- `stripe_services.py` (snow checkout), billing settings pages
- `navigation.js`, `App.js` routes, `ProviderLayout.js` / `postLoginRoute.js` member filters
- Requirements files

**Do not modify:**

- `businesses/location.py`
- Capacity helpers in `jobs/models.py`
- `provider_book_customer`
- The complete API in `views.py`
- Customer Find / Home / Browse pages
- `storeLinks.js` / install rules

## 7. Docs to update while building

- `docs/PRODUCT_RULES.md`: add "§ Snow dispatch" (summary of §3–§4.7) in M0, extended per milestone.
- `docs/TEST_STRATEGY.md`: add the dispatch suites.
- `AGENTS.md`: add new migrations under "Recent migrations" as they land.

## 8. Definition of done (whole module)

- An appointment org's UI, emails, nudges, search, and capacity are byte-for-byte unchanged in behavior (existing suites green).
- A snow org can do the full flow on the live site: opt in → invite 3 crew → add properties in 2 regions → storm alert → wizard with seasonal group + one-time stops and time costs → commit → crew start / navigate / photo / done → master live % and GPS → customer scheduled / 30-min / done notifications and the 5 km status page → one-time invoice issued.
- No prices are visible to crew anywhere (API and UI).
- Weather runs on a commercial key before any snow org is charged.

## 9. Assumptions (confirm with the owner if in doubt)

1. The snow plan replaces Pro (includes Pro features) rather than being added on top of it.
2. Seasonal stops are not bookings, so they don't appear in booking analytics. Run history is the record.
3. Tracking requires the crew app to be open (no background GPS).
4. The master is the org owner. Separate dispatcher accounts come later.
