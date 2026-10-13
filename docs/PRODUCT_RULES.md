# Luminexa — Product rules (source of truth)

This document is the durable product truth for Auto / mixed-model agent sessions. Cursor rules under `.cursor/rules/` are short bindings; **this file has the examples and edge cases**. Do not invent conflicting behavior.

Related: `.cursor/rules/booking-capacity.mdc`, `location-search.mdc`, `provider-locations.mdc` · `docs/TEST_STRATEGY.md` · `docs/AGENT_PLAYBOOK.md`

---

## Capacity — concurrent bookings on one slot

### What it means

`Organization.concurrent_capacity` (default **1**, PositiveInteger, typically clamped 1–50 in UI) is how many customer jobs can overlap **at the same time**. Each open availability slot can accept that many simultaneous bookings.

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

- Business signup: “Jobs at the same time” (`RegisterBusinessPage.js`)
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

### Keyword search (related services)

Free-text `q` on Find / Home / Browse does **not** require choosing a category first.

Matching uses:

1. Full-phrase and per-token `icontains` on service name, description, and category name
2. Synonym expansion (e.g. detailing ↔ car wash / auto care)
3. Platform `BusinessType` language (name / description / slug) → services in that category
4. Organization **tagline** only (never org name alone — that would dump unrelated catalog items)

When results come from expansion rather than an exact phrase hit, APIs may return `match_mode: "related"`. Dual-radius location rules are unchanged.

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
- Do not revert keyword search to full-phrase-only `icontains` (related/token expansion is intentional).
- Do not expand the catalog from organization **name** alone.

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

## App install — Play Store only

Customers must install **the latest Play Store app** (`com.luminexa.app`), not a browser PWA.

### What it means

Chrome “Install app” / Add to Home Screen creates a **second Luminexa** that can be an older cached web copy. The in-app banner and any future install CTA must open `PLAY_STORE_URL` in `frontend/src/utils/storeLinks.js`.

### Binding details

- Block `beforeinstallprompt` (`preventDefault`); never call `.prompt()`.
- Manifest: `prefer_related_applications: true` + Play `related_applications`.
- iOS: no banner until `APP_STORE_URL` is set. Do not teach Add to Home Screen.
- Android App Links (`https://app.luminex-a.com`) belong in the Capacitor `AndroidManifest` so booking links open the installed app after a Play update.

### What NOT to simplify away

- Do not ship a “Install this website” / PWA path alongside Play.
- Do not pin a versionCode or APK in the install link — Play serves the current listing.

---

## On the way — optional provider location share (app only)

### What it means

For a **confirmed** booking (same 6-hour window as Start job), staff on the **Capacitor app** may optionally tap **I’m on my way**. The customer gets a push/in-app alert and can see **distance in km** (text only, no map). Sharing ends when they stop, start the job, complete, cancel, or mark no-show.

### Binding details

- Optional — providers can skip it and still Start job.
- **App only** — do not show the control on web.
- Distance is haversine km from provider GPS to geocoded `service_address` (stored as booking `service_latitude` / `service_longitude`).
- Provider app pings location about every **5 minutes** while sharing is active (screen open).
- Customer gets a **one-time** nearby notification when distance first drops to **≤ 5 km**.
- Customer sees distance on **Home** (banner + Up next card) and booking detail — text km only.
- Not a booking status — status stays `confirmed` until Start job.

### What NOT to simplify away

- Do not require on-my-way before Start job.
- Do not expose a live map or continuous GPS stream in v1.
- Do not show the action outside the native app.

---

## App store rating (native only)

After **≥1 week** of use in the Capacitor Play / iOS shell, show a soft “Enjoying Luminexa?” prompt that opens the **store listing** (Play, or App Store when `APP_STORE_URL` is set). This is separate from **provider/job reviews** (`CustomerRatePrompt`).

### Binding details

- **Skip** browser and webview users entirely (`isNativeApp()` only).
- Record `firstOpenedAt` on first native open; do not prompt before 7 days.
- Dismiss or “Rate” permanently stops the prompt for that install.
- iOS: no prompt until `APP_STORE_URL` is live (do not send users to App Store search).
- Destination is always `getStoreReviewUrl` / `storeLinks.js` — never a fake in-web star UI.

---

## Quick “shipped truths” checklist for agents

1. Capacity default 1; UI label “Jobs at the same time”; FK not OneToOne; OPEN while remaining > 0.
2. Dual radius in `location.py`; lat/lng preferred; postal for ungeocoded.
3. Multi-location any-branch match; primary sync; 2nd-location choice UX.
4. Behavior changes need tests per `docs/TEST_STRATEGY.md`, not conflicting reinvention.
5. Install = latest Play Store listing (`storeLinks.js`); never browser PWA.
5b. App rating = native only after ≥1 week; Play / App Store listing only (not webview).
5c. On-my-way = optional, app-only, km text + 5 km nearby push; not a status.
5d. Provider job nudges: 1h reminder; 30m before on-my-way prompt; 30m after start → start or “I couldn’t make it”.
6. Safety: in-app Report (reason + text) + chat Block; admin reviews reports; no auto-pause in v1.
7. Customer CSV import on Clients: silent User+membership create (no invite email); max 500 rows.
8. Referral rewards (optional per org): coupon credit only after referred customer **completes** a job; lifetime earnings cap + per-referral amount; per-job apply caps (% and $).
9. Rebook reminders: per **completed** catalog job; one-shot date; in-app + push + email; skip if already rebooked.

---

## Provider job nudges (confirmed appointments)

### What it means

For **confirmed** bookings, Celery Beat (`jobs.tasks.send_provider_job_nudges`, every 5 minutes) sends staff **in-app + push**:

1. **~1 hour before** — reminder that the job is coming up  
2. **~30 minutes before** — ask if they are on the way / can share location (skipped if already sharing)  
3. **~30 minutes after start** — ask if the job started; open to **Start job** or **I couldn’t make it** (not sent once status is `in_progress` / cancelled / completed)

Deep link: schedule booking detail. Reschedule clears the three sent-at sentinels so nudges can fire for the new time.

### Past-due confirmed jobs (provider missed)

After **scheduled start**, staff cannot use generic Cancel on a still-`confirmed` booking. They must choose:

- **Start job** — they are doing the work (late), or  
- **I couldn’t make it** — provider fault; cancels the job; timeline `provider_could_not_make_it`; customer notified they can rebook; **not** counted as customer no-show  
- **Mark customer no-show** — only when the *customer* didn’t show

### What NOT to simplify away

- Do not auto-cancel — provider must resolve.
- Do not use customer no-show when the provider missed the job.
- Do not require on-my-way before Start (nudge is optional).
- Do not spam — one notification per stage per booking (sentinel fields).

---

## Rebook reminders (per completed job)

### What it means

When completing a catalog booking (or later from the completed job detail), the provider may schedule a **one-shot** “book again” reminder for a future calendar date (e.g. tire change → next Apr 1, snow cleaning → next Oct 1).

On that date (org timezone), Luminexa sends **in-app + push + email** with a deep link to book the same service again. Model: `BookingRebookReminder` · sweep: Celery Beat `jobs.tasks.send_due_rebook_reminders`.

If the customer already booked the same org+service again after the source job, the reminder is **skipped** (not sent). Gig/custom jobs (`job_title` set) cannot schedule rebook reminders.

### What NOT to simplify away

- Do not invent service-level default cadence in place of per-job scheduling (v1 is per completed job only).
- Do not drop email/push — channels match appointment reminders.
- Do not send when the customer already rebooked the same service.

---

## Referral rewards (provider opt-in)

### What it means

Owners enable **Referral rewards** in Settings (toggle) with:

- **Credit per referral** (`referral_reward_amount`)
- **Max a person can earn** (`referral_max_earnings_per_referrer`) lifetime coupon credit at that business
- **Max percent of job** (`referral_max_credit_percent_per_job`) — share of invoice pre-tax that credit may cover
- **Max dollars per job** (`referral_max_credit_amount_per_job`) — hard dollar ceiling on one invoice

Customers share `?ref=CODE` on the booking URL. Attribution is stored when the referred person books. **Coupon credit is issued only when that referred person's booking is marked completed.** Credit applies automatically as invoice discount on the referrer's next invoice with that provider (pre-tax).

**Per-job apply rule:** discount = `min(available credit, pre_tax × percent/100, dollar cap)`. Example: 50% + $100 on a $1,000 job → $100 off (not $500). Leftover credit stays for later invoices with the same provider.

Turning the toggle **off** stops new attributions / share UI. Existing available coupon credit still applies on invoices (still within per-job caps). Pending referrals (already booked with a code) still qualify on completion.

### What NOT to simplify away

- Do not grant credit on book / pay alone — completion is required.
- Do not allow self-referral.
- Do not ignore the lifetime cap (partial last grant is OK).
- Do not ignore per-job % and $ caps when applying credit (both apply; use the lower).
- Coupons are provider-scoped.
- Do not wipe existing coupons when the program is turned off.

---

## Safety — report and chat block (v1)

### What it means

Customers and providers can **Report** (reason + written details) and **Block** messaging from the chat ⋯ menu. Reports land in Django admin (`SafetyReport`) and email `SUPPORT_EMAIL`. Blocking stops human messages both ways for that org↔customer pair (`ChatBlock`). Staff remove or pause accounts manually (`Organization.is_active` / `profile_public`, or user `is_active`) — no auto-pause from report volume in v1.

### What NOT to simplify away

- Do not call `beforeinstallprompt` / PWA install as a substitute for safety controls.
- Do not auto-suspend on a single report.
- Keep chat Block separate from org `customer_status=blocked` (booking gate).

### Org customer block (Clients list)

`customer_status=blocked` stops the customer from **booking**, **rescheduling**, **connect / request access**, and **service inquiries**. Staff must **Unblock** (not Approve) to restore access. Separate from chat Block.

---

## Customer CSV import (provider Clients)

### What it means

Providers can **Import CSV** on Clients (`full_name`, `email`, `phone`, optional `provider_notes`) to seed My customers from Excel or another tool. Creates or links real `User` rows + `OrganizationMembership` (`approved`). **No invite / OTP emails.** Cap **500** rows per upload. Template: `GET …/customers/import-template/`.

### What NOT to simplify away

- Do not blast welcome emails on import.
- Do not invent membership-only stubs without a User (Clients and bookings need `user_id`).
- Existing platform users with the same email are **linked** to the org, not duplicated.

---

## Sessions — max two devices per account

### What it means

An account may be signed in on **at most two devices at once** (typical: web browser + phone app). Logging in on a second device must **not** sign the first one out.

A **third** login creates a new session and signs out the **oldest** of the two existing sessions. Logging out on one device leaves the other signed in.

Code: `accounts.AuthToken` (FK, not DRF’s one-token-per-user `Token`) · `accounts.auth_sessions.issue_auth_token_response` · cap `AUTH_MAX_CONCURRENT_SESSIONS` (default **2**).

### What NOT to simplify away

- Do not rotate/delete all tokens on every login (that is what signed web off when the phone signed in).
- Do not use DRF `authtoken.Token` (OneToOne) as the SPA session — it cannot hold two devices.
- Logout deletes **this device’s** token only, not every session for the account.

