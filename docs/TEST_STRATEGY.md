# Luminexa — Test strategy (high-value only)

Goal: protect capacity, dual-radius search, and multi-location behavior. **Do not mass-generate shallow tests.** Prefer a few assertions that encode product rules.

Cheaper / Auto models: **implement cases from this plan**. Do not invent conflicting product behavior — read `docs/PRODUCT_RULES.md` first.

---

## Commands

```bash
cd backend && .venv/bin/python manage.py test

# Focused suites (run these for related work)
.venv/bin/python manage.py test jobs.tests.test_bookings
.venv/bin/python manage.py test businesses.tests.test_location_radius
```

Use the focused suite that matches the change. Full suite before claiming done on cross-cutting booking/search work.

---

## Existing key tests (extend; don’t duplicate poorly)

| Area | Module | What it already covers |
|------|--------|------------------------|
| Capacity | `jobs.tests.test_bookings` | Two bookings same slot; third rejected; default capacity=1 rejects second; cancel frees a seat; public calendar `available` when 1 of 2 filled; owner PATCH capacity |
| Dual radius + multi-location | `businesses.tests.test_location_radius` | Provider radius hides far orgs; both radii required; tight customer radius; ungeocoded postal; any-branch match; nearby but provider radius too small; inactive locations excluded; locations API; primary → `service_*` sync; max locations enforced |

## Browse categories vs catalog services

Customer **Popular categories** / type browse list a provider only when that org has
**≥1 active service** in a `ServiceCategory` whose name matches the platform
`BusinessType` name. Org `business_types` tags alone are not enough.

Code: `jobs.catalog.organizations_with_services_for_business_type`,
`business_types_with_service_provider_counts` · API: `business_type_providers_api`,
customer home / discover type tiles.

Test: `businesses.tests.test_browse_by_category`


---

## High-value areas (priority order)

1. **Concurrent capacity** — bookability, slot status OPEN while seats remain, FK multi-booking, reject when full
2. **Dual-radius search** — intersection of customer × provider radius; postal fallback for ungeocoded
3. **Multi-location** — any active branch matches; primary sync; max locations enforcement
4. Booking state machine regressions only when touching `booking_services.py` (cancel/reschedule must release seats correctly)

Skip: cosmetic UI snapshots, exhaustive serializer field lists, duplicate happy-path CRUD with no product assertion.

---

## Template cases — capacity

Implement (or keep green) these behaviors:

1. **Org capacity 2, first booking** → HTTP 201; `slot.status == OPEN`; `remaining_capacity == 1`
2. **Second booking same slot** → 201; remaining 0; status BOOKED (or full per `refresh_status`)
3. **Third booking** → 400
4. **Cancel one occupying booking** → seat frees; slot bookable again (`is_bookable` / remaining > 0)
5. **Default capacity 1** → second simultaneous booking on same slot rejected
6. **Owner PATCH `concurrent_capacity`** → persists (authz: owner only)

Customer calendar (if API-tested): public/month slots with remaining > 0 must report `available: true` even when `occupied_count >= 1`.

---

## Template cases — dual radius

1. Customer 25 mi, provider serves 5 mi, distance ~20 mi → **not** in distance map
2. Same pin / within both radii → visible; distance ~0
3. Customer radius 5 mi excludes otherwise far providers even if provider radius is large
4. Ungeocoded org with matching `search_postal` prefix → included at distance 0
5. Provider ~8 mi away with provider radius 5 → hidden even if customer searches 25

Function under test: `organization_distances_within_radius(lat, lng, radius_miles, search_postal=...)`.

---

## Template cases — multi-location

1. Org with far primary (outside its radius) + nearby secondary (inside both radii) → org **visible**; distance reflects near branch
2. Only inactive locations would match → org **not** visible (if covered)
3. Create location via API up to max; exceeding `MAX_PER_ORGANIZATION` (20) → error
4. Setting primary updates org `service_*` mirror fields (when API/serializer tests exist)

---

## Definition of done for test work

- New test name states the product rule (not “test_1”)
- Asserts status codes **and** capacity/search outcomes
- Does not change product rules to make a test pass — fix code or update `PRODUCT_RULES.md` only with explicit product intent
