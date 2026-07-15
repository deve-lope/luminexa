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

## Graphics you’ll need (you still supply)

- App icon: use `frontend/public/icons/icon-512.png`
- Feature graphic: 1024×500 (Play requirement — create separately)
- Phone screenshots: at least 2 (can reuse PWA screenshots once you upload nicer ones)

---

## Data safety (declare honestly)

**Collected / shared for app functionality** (typical Luminexa answers — adjust if your practices differ):

| Data type | Collected? | Shared with other users/providers? | Purpose |
|-----------|------------|------------------------------------|---------|
| Name | Yes | Yes (with the other party on a booking) | Account, bookings |
| Email | Yes | Usually no (account); may appear to provider as needed | Account, auth |
| Phone | Yes (if provided) | Yes (booking contact) | Account, bookings |
| Approximate location | Yes (search / service area) | Service area may be public on storefront | Find providers |
| Precise location | Optional (if user allows GPS) | Not sold; used for search | Find providers |
| Photos | Yes (provider gallery / profile if uploaded) | Yes (public storefront) | Profile |
| App activity / bookings | Yes | Yes (between customer & provider) | Bookings |
| Device IDs / crash logs | Possibly via hosting logs | No | Security / reliability |

Also declare:
- Data encrypted in transit: **Yes** (HTTPS)
- Users can request deletion: **Yes** (email support@luminex-a.com)
- Committed to Play Families / kids: **No** (not directed at children)

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

Next engineering step: wrap https://app.luminex-a.com/ with **Bubblewrap** or **PWABuilder**, then upload the AAB to Internal testing.
