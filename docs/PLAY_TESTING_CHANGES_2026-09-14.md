# Luminexa — Play testing changes (for production handoff)

**Last updated:** 20 Sep 2026 (adds today’s product + Play Console edge-to-edge fix)  
**Original write-up:** 14 Sep 2026  
**App:** Luminexa (`com.luminexa.app`)  
**Upload target for this notes pass:** versionCode **10** / **1.1.7**  
**Live web:** https://app.luminex-a.com/  
**Audience:** Play Console / closed testing → production review notes  

The Android app is a WebView / store shell over the live SPA. Most fixes below ship with a **web deploy** (no new AAB) unless marked **native / AAB**.

---

## How to use this in Play Console

| Place | What to paste |
|-------|----------------|
| **Release notes (“What’s new”)** | Short bullets in [§ Play release notes (short)](#play-release-notes-short) |
| **Internal / closed testing notes** | Full sections below |
| **Reviewer notes** | Safety, offline, billing gating, UGC (Report / Block), and Android 15 edge-to-edge |

---

## Play release notes (short)

Suggested “What’s new” copy (paste for **10 / 1.1.7**):

- Android 15 display fix: removed deprecated status-bar APIs flagged by Play; edge-to-edge insets unchanged
- Smaller install: Android Studio handoff zips no longer bundled into the Play app
- Rate Luminexa on Google Play after a week of use (native app only)
- First-run app tour and clearer logout confirmation
- Smarter Find search with related service matches; simpler Home / Book location flow
- Gig Wall redesigned as a full-bleed notice board with compact sticky notes
- Chat colors aligned with brand; clearer provider gig navigation labels
- Improved in-app messaging (Ongoing jobs, safer menu, teal bubbles)
- Book again from finished jobs (today’s price / new quote — never reuses an old quote)
- Clearer Bookings tabs: Coming up, Quotes, Done
- Referral rewards for providers after a referred job is completed
- Stronger account safety: admin login lockout; one Pro trial per email
- Offline screen when the phone has no network (native app)

---

## Changes from 20 Sep 2026 (include in this upload)

### Play Console suggestion — Android 15 edge-to-edge (**native / AAB**)

Play flagged release **7** under “For your next release”:

1. **Edge-to-edge may not display for all users** (SDK 35+ advisory — test insets)
2. **Deprecated APIs for edge-to-edge** — scanner saw old window bar-color APIs

**What we changed for 9 / 1.1.6:**

| Change | Detail |
|--------|--------|
| Removed `@capacitor/status-bar` | Stops shipping `Window.getStatusBarColor` / `setStatusBarColor` and old `SYSTEM_UI_FLAG_*` usage Play listed |
| Status icons | Capacitor 8 `SystemBars` only (`systemTheme.js`) |
| Insets / bar chrome | Unchanged — Capawesome `EdgeToEdge` still handles safe areas and bar overlay colors |
| Studio pack | Pack script no longer includes `status-bar` under `node_modules` |

**Note:** Capawesome may still mention `setStatusBarColor`-style **helper names** in a soft scan; those are overlay views for teal/dark chrome, not the removed deprecated `Window.*` APIs. The first Play tip can remain as a general Android 15 reminder.

### Product / UX (mostly web — already on live SPA; AAB picks them up on next load)

| Change | Detail |
|--------|--------|
| **Store rating prompt** | Native-only: after ~1 week of use, prompt to rate on Play (**AAB / web in shell**) |
| **First-run app tour** | Short guided tour for new users |
| **Logout confirm** | Confirm before signing out |
| **Find / Home** | Related keyword matches; Home as dashboard; clearer Book location entry |
| **Gig Wall** | Full-bleed ash board + compact sticky-note cards (customer + provider) |
| **Chat / nav polish** | Brand canvas chat colors; tidier provider gig nav labels |

**Git (20 Sep):** `5215d1f`, `7f97d26`, `fd30045`, `556674e`, `5fb3a11`, `1fa43b4` (+ uncommitted native Status Bar removal for **9 / 1.1.6**)

---

## Changes from today’s session (14 Sep 2026)

These are the product/UI items exercised during this day’s testing and deployed to production web.

### 1. Customer messages / chat

| Change | Detail |
|--------|--------|
| **⋯ menu overlay** | Report / Block menu draws above sent bubbles; tap anywhere else to dismiss (no need to tap ⋯ again) |
| **Provider name → page** | Tapping the provider name or avatar in chat opens their customer provider page |
| **Ongoing strip** | Same behavior (open bookings + quote requests); redesigned as compact chips under a white header so it doesn’t clash with the system teal status bar |
| **Sent bubble color** | Your messages use brand light teal (not WhatsApp green) |
| **Chat background** | Soft app canvas (`#F6F7F5`) for better match with teal bubbles + white header |
| **No sender name on every bubble** | Incoming messages no longer repeat the other person’s name above each text |

**Criteria for “Ongoing” (unchanged logic):** open by **status**, not by preferred date. Quote requests stay until cancelled / declined / dismissed / completed. Deleting from Quotes removes them from Ongoing.

### 2. Book again (Done / completed jobs)

| Change | Detail |
|--------|--------|
| **Where** | Done list cards and full job detail |
| **What it does** | Starts a **new** booking for the same service on the live book page |
| **Quote-first jobs** | Opens the normal quote/request flow; helper text: previous price does **not** carry over |
| **Price changes** | Always shows **today’s** catalog price / asks for a **new** quote — never clones the old invoice amount |

### 3. Bookings navigation & copy

| Change | Detail |
|--------|--------|
| **Tabs** | Renamed / cleaned: **Coming up**, **Quotes**, **Done** |
| **Menu** | “Completed jobs” → **Past jobs** |
| **Pages** | Shorter empty states; invoice/bill preview lives on the Done cards; less redundant headings |

### 4. Find / discover search accuracy

| Change | Detail |
|--------|--------|
| **Keyword match** | Matches **service** name, description, and category — not the whole org address/name dump |
| **Why** | Searching “clean” no longer pulls unrelated services (e.g. oil change) just because the business name contains “Cleaning” |
| **Crash fix** | Keyword discover no longer crashes when filtering by business type |

### 5. Find results UI polish

| Change | Detail |
|--------|--------|
| **Results header** | Clearer “Results for …” / nearby counts |
| **Service cards** | Uses shared bookable service card presentation |
| **Loading / empty** | Cleaner loading spinner and empty states |

---

## Other commits shipped the same day (14 Sep)

Also on branch / testing build, useful for the 14-day window narrative:

### Provider referral rewards
- Customers share `?ref=` links; **coupon credit** is issued when the referred person’s job is **completed**
- Credit applies on later invoices with that provider

### Subscription / admin safety
- **Admin login lockout** after failed attempts
- **One Pro trial per email**
- Clearer “subscription remaining” labels in UI

### Native offline (AAB-relevant if not already on testers’ build)
- Cold start with **no network** shows a real offline screen (iOS/Android Capacitor)
- Mark as **native** if testers need an updated store build to see it

---

## Broader closed-testing window (store prep → this release)

High-level themes already in the testing track (for a verbal walkthrough), not only today’s diff:

| Theme | Examples |
|-------|----------|
| **UGC / safety (Play policy)** | In-app **Report** and **Block** messaging; client block/remove on provider Clients |
| **Native shell** | Capacitor Android/iOS WebView over live site; FCM push; safe areas; keyboard not covering fields |
| **Billing / store rules** | Hide Stripe Pro subscribe/portal CTAs inside Capacitor store shell; staff seat limits on base Pro |
| **Booking / jobs** | Quote flows, post-visit attendance follow-ups, invoice pay, rate & review |
| **Provider tools** | CSV customer import (with confirm), tasks, schedule compactness, services UI |
| **Install policy** | Play Store install path only — no browser “Add to Home Screen” / PWA install CTAs |
| **Discover / location** | Keyword-first Find, ZIP/radius dual-radius search, city SEO pages |

---

## What does **not** need a new Play AAB

These ship when the production SPA is rebuilt/redeployed (`docker compose build frontend && docker compose up -d frontend`):

- Chat UI, Book again, bookings tabs, discover keyword fix, referral credit logic (API + web), Gig Wall UI, Home/Find polish, app tour, most safety UI already on the live site

**Does need a new AAB** when native plugins / Capacitor config change — including this release’s **Status Bar removal** (Play edge-to-edge scan) and store rating / offline shell if testers are still on an older native binary.

---

## Suggested tester smoke checklist (post-deploy)

1. **Messages** — open chat → Ongoing chips → tap chip → detail; ⋯ Report/Block overlays correctly; tap outside closes menu; tap provider name → provider page  
2. **Done** — open a completed job → **Book again** → lands on live service book/quote flow  
3. **Find** — search a word that appears only in a business name; confirm unrelated services from that org do **not** appear; try related matches  
4. **Bookings tabs** — Coming up / Quotes / Done labels and empty states  
5. **Gig Wall** — full-bleed board layout; sticky notes readable on phone  
6. **Offline (native)** — airplane mode cold start → offline screen (if on build that includes it)  
7. **Safety** — Report + Block from chat still work  
8. **Edge-to-edge (native 9+)** — status/nav bars don’t cover header or bottom tabs; teal/dark chrome still looks correct  

---

## Git references

**20 Sep 2026** (this upload):

- `5215d1f` — Native store rating prompt after one week  
- `7f97d26` — First-run app tour, logout confirm  
- `fd30045` — Related service keyword matches  
- `556674e` — Home dashboard, Book location entry  
- `5fb3a11` — Gig Wall full-bleed ash board  
- `1fa43b4` — Chat brand colors, gig nav labels  
- *(working tree)* — Remove `@capacitor/status-bar` for Play Android 15 deprecation scan → **9 / 1.1.6**

**14 Sep 2026** (earlier closed-testing narrative):

- `a365d4b` — Tighten discover keyword matching and simplify customer bookings UI  
- `6e396d0` — Improve customer chat chrome and add Book again on completed jobs  
- `7c8b56b` — Fix customer keyword discover crashing on business-type filtering  
- `a60f3f6` — Admin login lockout, one Pro trial per email, subscription remaining labels  
- `60733c5` — Provider referral rewards with coupon credit after completed jobs  

---

*Document for Play closed-testing → production. Upload AAB **10 / 1.1.7** (slim pack — no Studio zips inside the app).*
