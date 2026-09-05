# App Store Connect listing draft (Luminexa)

Paste these values into [App Store Connect](https://appstoreconnect.apple.com) →
**My Apps → Luminexa**. You must be signed in with the Apple Developer account
that owns the app (`com.luminexa.app`).

**Live URLs**

| Purpose | URL |
|---------|-----|
| App / website | https://app.luminex-a.com/ |
| Privacy policy | https://app.luminex-a.com/privacy |
| Account deletion (public) | https://app.luminex-a.com/delete-account |
| Support email | support@luminex-a.com |

Prepared screenshot assets (iPhone **6.5"** — 1242×2688):

- `frontend/public/appstore/01-find-6.5.png`
- `frontend/public/appstore/02-bookings-6.5.png`
- `frontend/public/appstore/03-messages-6.5.png`

Also available (iPhone **6.7"** — 1290×2796) if ASC asks for that size:

- `frontend/public/appstore/01-find.png`
- `frontend/public/appstore/02-bookings.png`
- `frontend/public/appstore/03-messages.png`

Marketing icon:

- `frontend/public/appstore/icon-1024.png` (reference; Xcode already has the App Icon set)

---

## Click path (do this in order)

1. Open [App Store Connect](https://appstoreconnect.apple.com) → **My Apps**.
2. Open **Luminexa** (bundle ID `com.luminexa.app`). If it does not exist yet:
   **+** → New App → iOS → name **Luminexa** → primary language **English (U.S.)**
   → bundle ID `com.luminexa.app` → SKU e.g. `luminexa-ios` → Full Access.
3. Left sidebar → **App Information** (fill identity below).
4. Left sidebar → **App Privacy** (nutrition labels).
5. Left sidebar → **Pricing and Availability** → Free → all countries you want.
6. Under **iOS App** → create / open version **1.0** (or current).
7. Fill **Version Information** (description, keywords, screenshots, review notes).
8. Leave **Build** empty until the Mac uploads a new Archive; then pick that build
   and **Add for Review** / **Submit**.

You can finish listing **before** choosing a build. Submission needs a build.

---

## App Information

| Field | Value |
|-------|--------|
| Name | Luminexa |
| Subtitle (≤30 characters) | Book local services nearby |
| Bundle ID | com.luminexa.app |
| Primary language | English (U.S.) |
| Category — Primary | Lifestyle |
| Category — Secondary | Business *(optional)* |
| Content Rights | Does not contain third-party content you don’t have rights to |
| Age Rating | Complete questionnaire → expect **4+** (no unrestricted web, no gambling, etc.) |

**Age Rating questionnaire (typical answers for Luminexa)**

| Topic | Answer |
|-------|--------|
| Cartoon / fantasy violence | None |
| Realistic violence | None |
| Sexual content / nudity | None |
| Profanity | None |
| Horror / fear | None |
| Mature / suggestive themes | None |
| Alcohol / tobacco / drugs | None |
| Contests | None |
| Gambling | None |
| Unrestricted web access | **No** (in-app WebView is your own app site, not open Safari browsing) |
| User-generated content | **Infrequent/Mild** if asked (chat messages / profile photos between customers & providers) — or follow ASC prompts for messaging apps |
| Medical / treatment info | None |

If ASC asks about **Made for Kids** → **No**.

---

## Version Information (1.0)

### Promotional text (≤170 characters, can change without a new review)

```
Find nearby service providers, book open slots, message businesses, and track jobs — all in one place.
```

### Description (≤4000 characters)

```
Luminexa helps you book local services nearby — simply and quickly.

For customers
• Search by ZIP / address and miles
• Browse providers that serve your area
• Request or book open time slots
• Message businesses and share photos
• Track upcoming bookings and invoices

For businesses
• Publish your services and service area
• Set how many jobs you can take at the same time
• Manage schedule, requests, quotes, and jobs
• Chat with customers from a mobile-friendly dashboard

Luminexa uses secure notifications so you don’t miss booking updates, messages, or invoice alerts.
```

### Keywords (≤100 characters total, comma-separated, no spaces after commas preferred)

```
booking,local services,schedule,appointments,providers,quotes,home services
```

(Count carefully in ASC — stay under 100 characters.)

### Support URL

```
https://app.luminex-a.com/
```

### Marketing URL *(optional)*

```
https://app.luminex-a.com/
```

### Privacy Policy URL *(required)*

```
https://app.luminex-a.com/privacy
```

### Copyright

```
© 2026 Luminexa
```

---

## Screenshots

**Required:** at least one size. For **iPhone 6.5" Display** use **1242×2688**.

1. Open version → **Screenshots** → **iPhone 6.5" Display**.
2. Upload in order:
   1. `frontend/public/appstore/01-find-6.5.png` — Find / search
   2. `frontend/public/appstore/02-bookings-6.5.png` — Bookings
   3. `frontend/public/appstore/03-messages-6.5.png` — Messages
3. You can leave iPad screenshots empty (app is iPhone-only).

Tip: pull the three files onto your Mac (AirDrop, Drive, or `scp`), then drag into ASC.

If ASC also requires **6.7"**, use the non-`6.5` files in the same folder (1290×2796).

---

## App Privacy — quick answers (repeat for every data type)

For **each** type you selected (Name, Email, Phone, Address, Location, Messages, Photos, User ID, Device ID, Purchases, Product Interaction, Search History, Crash/Performance):

1. **How used?** → **App Functionality** only  
2. **Linked to identity?** → **Yes**  
3. **Used for tracking?** → **No**

Do not tick Advertising, Marketing, Analytics, or Personalization unless you add those later.

---

## Pricing and Availability

| Field | Value |
|-------|--------|
| Price | Free |
| Availability | All countries you serve (or start with Canada / United States only) |
| Pre-order | No |

---

## App Review Information

| Field | Value |
|-------|--------|
| Contact first / last | Your name |
| Contact phone | Your mobile (Apple may call) |
| Contact email | support@luminex-a.com *(or your personal)* |
| Demo account | Provide a **customer** login Apple can use |
| Notes | See below |

### Review notes (paste into App Store Connect → Notes)

```
DEMO SIGN-IN (provider / business account — use the Sign-In fields):
Email: ajilbenny29@gmail.com
Password: (same password entered in Sign-In Information above)

This account is a BUSINESS / PROVIDER login (organization owner).
After sign-in you should land in the provider experience (schedule, requests, messages, settings).

How to review as a provider:
1. Sign in with the demo credentials above.
2. Allow notifications when prompted (native push).
3. Open Requests / Schedule to see bookings and customer requests.
4. Open Messages to chat with customers (photos/files supported).
5. Provider settings cover services, availability, and service area.

CUSTOMER FLOW (optional — OTP email login):
Customer accounts sign in with email + one-time code (no password).
To try the customer side:
1. Sign out (or use a fresh install / second device).
2. Choose customer sign-in and enter any email you can receive mail for.
3. Enter the OTP from that inbox, then use Home / Find, Bookings, and Messages.

Auth notes:
- No “Sign in with Apple” — email + password (providers) or email + OTP (customers).
- Payments (Stripe) are for real-world services, not digital goods (Guideline 3.1.1 exempt).
- Account deletion: Account → Delete account, or https://app.luminex-a.com/delete-account
- The iOS app is a Capacitor shell around https://app.luminex-a.com with native push, location, camera, and photo library access.
```

**ASC Sign-In Information fields**

| Field | Value |
|-------|--------|
| Sign-in required | Yes |
| User name | `ajilbenny29@gmail.com` |
| Password | *(the password you already entered — do not put it in Notes if you prefer)* |

---

## Export compliance

Already set in the binary (`ITSAppUsesNonExemptEncryption = false`). In ASC, choose:

- **Uses encryption?** → Yes (standard HTTPS) / or follow the wizard  
- **Exempt** / only uses standard encryption → **Yes**

---

## Checklist

- [ ] App record exists (`com.luminexa.app`)
- [ ] App Information: name, subtitle, categories
- [ ] Age rating questionnaire completed
- [ ] Privacy policy URL set
- [ ] App Privacy labels completed
- [ ] Pricing = Free + territories
- [ ] Version 1.0 description + keywords + URLs
- [ ] 3× iPhone 6.5" screenshots uploaded (1242×2688)
- [ ] Review contact + demo account + notes
- [ ] (Later) Select processed build → Submit for Review

---

## What I cannot do from this machine

App Store Connect requires **your Apple ID**. This Linux server cannot sign into ASC or upload screenshots for you. Use the copy and files above on the Mac (or any browser where you’re logged into ASC).

When the public listing is live, set `APP_STORE_URL` in `frontend/src/utils/storeLinks.js` to the `https://apps.apple.com/app/id…` link and redeploy the SPA.
