# Luminexa — Agent guide

Read this first in every coding session. Then follow [`docs/AGENT_PLAYBOOK.md`](docs/AGENT_PLAYBOOK.md). Detailed product rules live in `.cursor/rules/` (auto-attached by file) and `docs/` (linked below). **This pack is the source of truth** — do not rediscover behavior from chat history.

## Stack

| Layer | Path | Notes |
|-------|------|--------|
| Django 5 API | `backend/` | apps: `accounts`, `businesses`, `jobs` |
| React SPA | `frontend/` | CRA; mobile-first |
| Spec | `docs/LUMINEXA_PLATFORM_REPORT.md` | Original greenfield handoff |
| Env | `env/` | Docker vs native templates |

**Local ports (prod-local):** SPA `:3000`, API `:9001`. Dev stack: `:3001` / `:9002`.

## Before you change code

1. Match existing patterns; do not invent parallel systems.
2. Prefer small, focused diffs. No drive-by refactors.
3. Do not commit unless the user asks.
4. For product behavior, follow the rules below — do not “simplify” dual-radius or capacity.

## Critical product docs (read before related work)

| Topic | Where |
|-------|--------|
| Session playbook (Auto / mixed models) | [`docs/AGENT_PLAYBOOK.md`](docs/AGENT_PLAYBOOK.md) |
| Product truth (examples & edge cases) | [`docs/PRODUCT_RULES.md`](docs/PRODUCT_RULES.md) |
| Booking capacity (simultaneous workers) | [`.cursor/rules/booking-capacity.mdc`](.cursor/rules/booking-capacity.mdc) + PRODUCT_RULES § Capacity |
| ZIP / miles search (customer ∩ provider radius) | [`.cursor/rules/location-search.mdc`](.cursor/rules/location-search.mdc) + PRODUCT_RULES § Search |
| Multi-location / branches | [`.cursor/rules/provider-locations.mdc`](.cursor/rules/provider-locations.mdc) + PRODUCT_RULES § Locations |
| Test plan & high-value cases | [`docs/TEST_STRATEGY.md`](docs/TEST_STRATEGY.md) |
| Play Store / Android release | [`docs/PLAY_STORE_RELEASE.md`](docs/PLAY_STORE_RELEASE.md) |
| App Store / iOS release (Mac required) | [`docs/CAPACITOR_IOS.md`](docs/CAPACITOR_IOS.md) |
| iOS work split with a Mac collaborator | [`docs/IOS_MAC_COLLABORATOR.md`](docs/IOS_MAC_COLLABORATOR.md) |
| Play Console listing copy | [`docs/PLAY_CONSOLE_LISTING.md`](docs/PLAY_CONSOLE_LISTING.md) |
| TWA / Android build steps | [`docs/TWA_BUILD.md`](docs/TWA_BUILD.md) |
| Greenfield platform spec | [`docs/LUMINEXA_PLATFORM_REPORT.md`](docs/LUMINEXA_PLATFORM_REPORT.md) |

## Shipped product truths (do not reinvent)

1. **`concurrent_capacity`** on Organization (default 1). UI: “Jobs at the same time”. Slot bookable while `remaining_capacity > 0`. `Booking.availability_slot` is FK (`related_name=bookings`), not OneToOne.
2. **Dual-radius search**: visible only if distance ≤ customer `radius_miles` **and** ≤ that location’s `radius_miles`. Core: `organization_distances_within_radius`. Prefer lat/lng; still send postal for ungeocoded matches.
3. **Multi-location**: `OrganizationLocation`; search matches any active branch; primary syncs to `Organization.service_*`; 2nd+ location settings show separate account vs add on this profile.

## High-risk modules (touch carefully)

- `backend/jobs/booking_services.py` — booking state machine
- `backend/jobs/models.py` — `AvailabilitySlot` capacity helpers, `Booking` ↔ slot FK
- `backend/businesses/location.py` — radius search (dual radius + multi-location)
- `backend/businesses/api_views.py` — discover / public browse
- Provider settings: `BookingPolicySettings.js`, `ProviderServiceAreaSettings.js`
- Customer find: `CustomerFindPage.js`, `CustomerHomePage.js`, `LocationSearchBar.js`
- Also: `ServicesBrowsePage.js` (must send lat/lng, not postal-only)

## Commands

```bash
# Backend tests
cd backend && .venv/bin/python manage.py test

# Focused suites
.venv/bin/python manage.py test jobs.tests.test_bookings
.venv/bin/python manage.py test businesses.tests.test_location_radius

# Migrate
.venv/bin/python manage.py migrate

# Frontend (prod-local API on :9001)
cd frontend && npm start   # SPA :3000
```

## Recent migrations (do not recreate)

- `businesses.0016_organization_concurrent_capacity`
- `businesses.0017_organizationlocation`
- `jobs.0025_booking_slot_capacity_fk` (Booking.slot OneToOne → FK)

## Definition of done

- Behavior matches `docs/PRODUCT_RULES.md`
- Related tests pass (or new tests added per `docs/TEST_STRATEGY.md`)
- No unrelated file churn
- No commit unless the user explicitly asked
