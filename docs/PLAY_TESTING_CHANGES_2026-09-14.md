# Luminexa — Play testing changes (for production handoff)

**Date of this write-up:** 14 Sep 2026  
**App:** Luminexa (`com.luminexa.app`)  
**Live web:** https://app.luminex-a.com/  
**Audience:** Play Console / closed testing → production review notes  

The Android app is a WebView / store shell over the live SPA. Most fixes below ship with a **web deploy** (no new AAB) unless marked **native / AAB**.

---

## How to use this in Play Console

| Place | What to paste |
|-------|----------------|
| **Release notes (“What’s new”)** | Short bullets in [§ Play release notes (short)](#play-release-notes-short) |
| **Internal / closed testing notes** | Full sections below |
| **Reviewer notes** | Safety, offline, billing gating, and UGC (Report / Block) |

---

## Play release notes (short)

Suggested “What’s new” copy:

- Improved in-app messaging (clearer Ongoing jobs, safer menu, teal message bubbles)
- Tap the provider name in chat to open their page
- Book again from finished jobs (uses today’s price / new quote — never reuses an old quote)
- Clearer Bookings tabs: Coming up, Quotes, Done
- Find search matches services more accurately (less unrelated results)
- Referral rewards for providers after a referred job is completed
- Stronger account safety: admin login lockout; one Pro trial per email
- Offline screen when the phone has no network (native app)

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

- Chat UI, Book again, bookings tabs, discover keyword fix, referral credit logic (API + web), most safety UI already on the live site

**Does need a new AAB** only when native plugins / Capacitor config / offline shell change and testers are still on an older native binary.

---

## Suggested tester smoke checklist (post-deploy)

1. **Messages** — open chat → Ongoing chips → tap chip → detail; ⋯ Report/Block overlays correctly; tap outside closes menu; tap provider name → provider page  
2. **Done** — open a completed job → **Book again** → lands on live service book/quote flow  
3. **Find** — search a word that appears only in a business name; confirm unrelated services from that org do **not** appear  
4. **Bookings tabs** — Coming up / Quotes / Done labels and empty states  
5. **Offline (native)** — airplane mode cold start → offline screen (if on build that includes it)  
6. **Safety** — Report + Block from chat still work  

---

## Git references (this branch)

Recent commits on `cursor/native-offline-no-internet-43bc` from 14 Sep 2026:

- `a365d4b` — Tighten discover keyword matching and simplify customer bookings UI  
- `6e396d0` — Improve customer chat chrome and add Book again on completed jobs  
- `7c8b56b` — Fix customer keyword discover crashing on business-type filtering  
- `a60f3f6` — Admin login lockout, one Pro trial per email, subscription remaining labels  
- `60733c5` — Provider referral rewards with coupon credit after completed jobs  

---

*Document generated for Play closed-testing → production presentation. Update versionCode / track name in Console when you attach the matching AAB or promote the web-backed release.*
