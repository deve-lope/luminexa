# Play Console listing draft (Luminexa)

Paste into [Google Play Console](https://play.google.com/console) when you create the app.  
**App / privacy URL (live):** https://app.luminex-a.com/privacy  

You must create the Play app yourself (Google account + developer registration). This file is the copy + Data safety checklist.

---

## App identity

| Field | Value |
|-------|--------|
| App name | Luminexa |
| Default language | English (United States) — change if you prefer |
| App type | App |
| Free / paid | Free |
| Category | Lifestyle or Business (pick one; Lifestyle fits consumer booking) |
| Email (store contact) | support@luminex-a.com *(change if you use another inbox)* |
| Website | https://app.luminex-a.com/ |
| Privacy policy | https://app.luminex-a.com/privacy |

Package / applicationId (set once in Bubblewrap; do not change later): e.g. `com.luminexa.app`

---

## Short description (≤ 80 characters)

```
Book local services near you — find providers and schedule in a few taps.
```

## Full description

```
Luminexa helps you book local services nearby — simply and quickly.

Customers
• Search by ZIP / address and miles
• Browse providers that serve your area
• Request or book open time slots
• Track upcoming bookings

Businesses
• Publish your services and service area
• Set how many people can work at the same time
• Manage schedule, requests, and jobs from a mobile-friendly dashboard

Install Luminexa on your phone for a fast, app-like experience powered by our secure web app at app.luminex-a.com.
```

---

## Graphics

Use these repo assets in Play Console:

- App icon: `frontend/public/icons/icon-512.png`
- Feature graphic: `frontend/public/play/feature-graphic.png` (1024×500)
- Phone screenshot 1: `frontend/public/play/phone-screenshot-find.png` (1080×1920)
- Phone screenshot 2: `frontend/public/play/phone-screenshot-bookings.png` (1080×1920)

The PWA install screenshots used by Chrome live separately in `frontend/public/screenshots/`.

---

## Data safety form (copy-paste answers)

Play Console → **App content → Data safety**. Answer the top-level gates first, then declare each data type below with the exact toggles.

### Section 1 — Overview gates

| Question | Answer |
|----------|--------|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS/TLS) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app (Account → Delete account) **and** web |

**Account deletion (Play Console → App content → Data safety → Account deletion):**

| Field | Value |
|-------|--------|
| Do users create accounts? | **Yes** |
| Can users request account + data deletion? | **Yes** |
| Deletion request URL (public, no login required) | **https://app.luminex-a.com/delete-account** |
| In-app deletion path | Account → **Delete account** |
| Data deleted vs retained | Profile (name/email/phone/address) deleted; booking/invoice records retained **anonymized** for legal/tax/dispute purposes |

### Section 2 — Data types (declare each of these)

For every row: **Collected = Yes**. Set **Shared** and **Required/Optional** per the table. Google never treats this as “sold”; do **not** tick any “sold to third parties” option.

| Play data type (category) | Collected | Shared | Processed ephemerally | Optional? | Purposes to tick |
|---------------------------|-----------|--------|----------------------|-----------|------------------|
| **Name** (Personal info) | Yes | Yes* | No | Required | Account management; App functionality |
| **Email address** (Personal info) | Yes | No | No | Required | Account management; App functionality |
| **Phone number** (Personal info) | Yes | Yes* | No | Optional | App functionality (booking contact); Account management |
| **Address** (Personal info) | Yes | No | No | Optional | App functionality (service area / search) |
| **Approximate location** (Location) | Yes | No | No | Required | App functionality (find providers by area) |
| **Precise location** (Location) | Yes | No | No | Optional | App functionality (GPS “near me” search) |
| **Photos** (Photos and videos) | Yes | Yes* | No | Optional | App functionality (provider storefront/profile gallery) |
| **App interactions / bookings** (App activity) | Yes | Yes* | No | Required | App functionality (bookings between customer & provider) |
| **Crash logs & diagnostics** (App info & performance) | Yes | No | No | Required | Analytics; App functionality (reliability/security) |

\* **“Shared” meaning:** on a booking, the relevant details (name, phone, uploaded profile photos, booking activity) are visible to the **other party** and, for providers, on the **public storefront**. This is user-to-user disclosure to make the service work — declare it as *Shared* for **App functionality**. It is **not** sold or shared with advertisers/data brokers.

### Section 3 — Security practices

| Question | Answer |
|----------|--------|
| Data encrypted in transit | **Yes** |
| Users can request data deletion | **Yes** (support@luminex-a.com) |
| Committed to the Play Families Policy (targets children) | **No** — not directed at children |
| Independent security review | Leave **No** unless you have one |

> If you ever add third-party analytics/ads SDKs later, revisit this form — the current answers assume first-party collection only (your own backend + hosting logs).

---

## Checklist in Play Console

1. [ ] Create app “Luminexa”
2. [ ] Set privacy policy URL → https://app.luminex-a.com/privacy
3. [ ] Store listing: short + full description above
4. [ ] Upload icon + feature graphic + screenshots
5. [ ] Complete Data safety form
6. [ ] Content rating questionnaire
7. [ ] Countries / pricing (Free)
8. [ ] After TWA/AAB exists → Internal testing track

---

## After listing shell exists

Next engineering step: wrap https://app.luminex-a.com/ with **Bubblewrap** (recommended) using
[`docs/TWA_BUILD.md`](TWA_BUILD.md), then upload the AAB to Internal testing.

Blockers for an agent-only workflow:

- You must create the Play Console app in your Google account.
- You must choose and keep the package ID (recommended: `com.luminexa.app`).
- A valid `assetlinks.json` requires the Android signing certificate SHA-256 fingerprint from the generated/signed app.
