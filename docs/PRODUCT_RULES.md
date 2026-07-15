# Luminexa — Product rules (source of truth)

This document is the durable product truth for Auto / mixed-model agent sessions. Cursor rules under `.cursor/rules/` are short bindings; **this file has the examples and edge cases**. Do not invent conflicting behavior.

Related: `.cursor/rules/booking-capacity.mdc`, `location-search.mdc`, `provider-locations.mdc` · `docs/TEST_STRATEGY.md` · `docs/AGENT_PLAYBOOK.md`

---

## Capacity — concurrent bookings on one slot

### What it means

`Organization.concurrent_capacity` (default **1**, PositiveInteger, typically clamped 1–50 in UI) is how many people can work **at the same time**. Each open availability slot can accept that many simultaneous bookings.

Applies to both:

- **Mobile / field** crews (two techs → two customers at 10:00)
- **Shop / chairs** (two chairs → two appointments in the same window)

There is **no** separate per-slot capacity column. Slot capacity is always derived from the org setting via `AvailabilitySlot.capacity`.

### Data model

- Field: `Organization.concurrent_capacity` (migration `businesses.0016`)
- `Booking.availability_slot` → **ForeignKey** to `AvailabilitySlot`, `related_name='bookings'` (migration `jobs.0025`). Multiple bookings may share one slot up to capacity.
- Helpers on `AvailabilitySlot` (`backend/jobs/models.py`):
  - `capacity` → `max(1, org.concurrent_capacity)`
  - `occupying_bookings_qs()` → bookings excluding `cancelled` and `completed`
  - `remaining_capacity()` → `capacity - occupied_count`
  - `is_bookable()` → `remaining_capacity() > 0`
  - `refresh_status()` → status stays **OPEN** while remaining > 0; only when full does it become PENDING / BOOKED from occupying booking states

### Settings location

- Business signup: “People working at the same time” (`RegisterBusinessPage.js`)
- Provider Settings → booking policy: same label (`BookingPolicySettings.js` → PATCH `concurrent_capacity`)

### Customer calendar vs provider timeline (1 of 2 seats filled)

Example: `concurrent_capacity = 2`, one confirmed booking on the 10:00 slot.

| Surface | Expected behavior |
|---------|-------------------|
| Customer booking calendar / public slots | Slot still **available** (`remaining_capacity: 1`). Must not disappear or show as fully booked. |
| Second customer book | Allowed until remaining hits 0. |
| Third customer | Rejected (400) when no seats left. |
| Provider schedule / timeline | May show occupying booking(s); `primary_booking()` returns the newest occupying booking for UIs that expect a single highlight — but the slot is not exclusively owned. |
| Slot status field | Remains **OPEN** while seats remain (`refresh_status`). |

Code paths: `jobs/public_views.py` (customer month view exposes `available`, `remaining_capacity`); `jobs/booking_services.py` gates on `slot.is_bookable()`.

### What NOT to simplify away

- Do not revert `Booking.availability_slot` to OneToOne.
- Do not close / hide the slot after the first booking when capacity > 1.
- Do not add a second independent “max bookings per hour” system that ignores `concurrent_capacity`.
- Do not count cancelled/completed bookings against capacity.

---

## Search — ZIP / miles dual radius

### Rule

A provider location matches only when **both** are true:

1. Distance ≤ **customer** search `radius_miles`
2. Distance ≤ **that location’s** provider service radius (`OrganizationLocation.radius_miles`, or legacy `Organization.service_radius_miles`)

Core: `organization_distances_within_radius` in `backend/businesses/location.py`.

### Examples

| Customer radius | Provider location radius | Distance | Result |
|-----------------|--------------------------|----------|--------|
| 25 mi | 10 mi | 0 mi (same pin) | Visible |
| 25 mi | 5 mi | ~20 mi | **Hidden** (outside provider area) |
| 5 mi | 25 mi | ~20 mi | **Hidden** (outside customer search) |
| 25 mi | 15 mi | ~8 mi | Visible if ≤ both |

### Lat/lng preferred; postal fallback

Customer Find / Home / Services browse should prefer **lat + lng + radius_miles**. Still send **postal** when available so ungeocoded providers whose postal prefix matches are included (treated as distance **0**, which always passes both radii).

- `CustomerFindPage.js`, `CustomerHomePage.js`, `ServicesBrowsePage.js` — prefer coords; postal is supplemental / fallback.
- Do not make Services browse postal-only when the user has selected an address with coordinates.

### Multi-location search

Org matches if **any** active `OrganizationLocation` satisfies dual radius. Distance reported is the nearest matching location. Inactive locations are ignored. Orgs with no location rows fall back to legacy `Organization.service_*`.

### What NOT to simplify away

- Do not filter by customer miles alone.
- Do not require geocoding for every org before search works (postal prefix fallback is intentional).
- Do not match only the primary location when secondary branches would qualify.

---

## Locations — multi-branch settings UX

### Model

`OrganizationLocation` (`businesses.0017`):

- Fields include name, `is_primary`, postal, lat/lng, `radius_miles`, `is_active`, sort_order
- `MAX_PER_ORGANIZATION = 20`
- Primary location mirrors onto `Organization.service_postal_code`, `service_latitude`, `service_longitude`, `service_radius_miles` (`sync_org_primary_from_location`)

API: organization locations list/create/update under `jobs/views.py` (org-scoped). Creating beyond max returns an error.

### Settings UX (`ProviderServiceAreaSettings.js`)

- Providers manage multiple service pins on one business profile.
- When adding a **second or later** location, show an explicit choice:
  1. **Register a separate business** → `/register/business` (own staff, calendar, booking policy, branding)
  2. **Add location on this profile** (same schedule/settings; customers find either pin)

Copy should make the tradeoff clear: separate account = independent discovery/booking; same profile = shared calendar and settings.

### What NOT to simplify away

- Do not remove the 2nd-location choice screen.
- Do not stop syncing primary → `Organization.service_*`.
- Do not raise/remove the max without product intent (currently 20).

---

## Quick “shipped truths” checklist for agents

1. Capacity default 1; UI label “People working at the same time”; FK not OneToOne; OPEN while remaining > 0.
2. Dual radius in `location.py`; lat/lng preferred; postal for ungeocoded.
3. Multi-location any-branch match; primary sync; 2nd-location choice UX.
4. Behavior changes need tests per `docs/TEST_STRATEGY.md`, not conflicting reinvention.
