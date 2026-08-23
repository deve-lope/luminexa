# Luminexa — iOS Help Guide

**Audience:** Mac collaborator who will build, sign, and ship the iOS app so
customers get **lock-screen push notifications** the same way Android already
does.

**Goal:** Install Luminexa on a real iPhone → grant notification permission →
sign in → receive pushes when the app is backgrounded or closed (invoice ready,
payment, new booking, cancel, etc.).

This is the **single handoff doc**. Deeper technical notes live in
[`CAPACITOR_IOS.md`](CAPACITOR_IOS.md) and
[`IOS_MAC_COLLABORATOR.md`](IOS_MAC_COLLABORATOR.md); follow **this** file in
order.

---

## How it works (one picture)

```
Event on server (invoice paid, booking, …)
        │
        ▼
Django API  ──FCM──►  Firebase project luminexa-c7587
        │                      │
        │                      ├── Android → Google Play services → phone
        │                      └── iOS → APNs → iPhone
        │
   DevicePushToken row
   (platform = android | ios)
```

Android is already live: the API has Firebase credentials, devices register
FCM tokens, and lock-screen pushes work.

iOS uses the **same API and the same Firebase project**. What is still missing
is Apple + Xcode setup so the iPhone can register an FCM token and APNs can
deliver it.

| Fact | Value |
|------|--------|
| Bundle ID | `com.luminexa.app` |
| App display name | Luminexa |
| WebView loads | `https://app.luminex-a.com` |
| Firebase project | **`luminexa-c7587`** (same as Android — do not create a new project) |
| Git remote | `git@github.com:deve-lope/luminexa.git` |
| Branch to use | `release/store-prep-v1` (or whatever the main dev says is current) |
| iOS project path | `frontend/ios/` |
| Push API | `POST /accounts/api/push-tokens/` with `{ token, platform: "ios" }` |

---

## Critical rules (read once)

1. **Do not SSH into the Linux server to build iOS.** Xcode only runs on macOS.
   Clone the repo **locally on the Mac**.
2. **Do not create a second Firebase project for iOS.** Add an iOS app under
   `luminexa-c7587` only. A key or plist from another project looks fine and
   never delivers.
3. **Never commit secrets:** `GoogleService-Info.plist`, APNs `.p8`, service
   account JSON. They are gitignored.
4. **Test on a physical iPhone.** Simulators do not get reliable FCM tokens.
5. The main developer keeps the Apple Developer Program membership and invites
   you to **their** team. Do **not** publish under your personal Apple account.

### Apple ID (friend) vs Apple Developer Program (owner)

These are **not** the same thing, and they do **not** have to share an email
with GitHub (`deve-lope`) or the owner’s git address (`ajil@luminexa.com`).

| Account | Who | Email | Pays $99? |
|---------|-----|-------|-----------|
| **GitHub** | **Both of you** | Same account / same repo `deve-lope/luminexa` | No |
| **Apple ID** | Friend | **His own email** (Gmail, iCloud, whatever he already uses on his iPhone) | No |
| **Apple Developer Program / Team** | Owner (Ajil / Luminexa) | Owner’s Apple ID | **Yes — owner only** |

**GitHub (shared):** You both clone and **push to the same repo**
(`git@github.com:deve-lope/luminexa.git`). There is no second GitHub project
for iOS. After Xcode work, he `git push`; the owner `git pull` on the Linux
server.

**Friend should (Apple):**

1. Use (or create) an **Apple ID he owns**. Any personal email is fine.
2. Tell the owner that Apple ID email so it can be invited in App Store
   Connect → Users and Access (role **Developer** or **App Manager**).
3. Sign into Xcode with **that** Apple ID, then pick the **owner’s Team**.

**Friend should not:**

- Enrol a second Apple Developer Program under his own name ($99) and publish
  Luminexa there — the store listing would belong to him.
- Log into Xcode as the owner / share the owner’s Apple ID password.
- Assume GitHub `deve-lope`, git `ajil@luminexa.com`, or any `develop101`
  address is the Apple ID. GitHub and Apple are separate. Apple ID = whatever
  email he uses for iCloud / the App Store.

---

## Who does what

| Phase | Main owner (Linux / Apple account) | You (Mac) |
|-------|--------------------------------------|-----------|
| 0 | Confirm API Firebase credentials + deploy SPA | — |
| 1 | Invite you to Apple team; register App ID | Clone, `npm install`, open Xcode |
| 2 | Firebase iOS app + APNs `.p8` upload (or you do APNs with their login) | Receive `GoogleService-Info.plist` out of band |
| 3 | — | Add plist, FirebaseMessaging SPM, Push capability |
| 4 | — | Archive → TestFlight → install on iPhone |
| 5 | Trigger a real event; verify `platform=ios` token in DB | Confirm lock-screen notification |

---

## Phase 0 — Already done on the server (you can skip)

The main developer has already:

- Wired Capacitor Android + FCM
- Set `FIREBASE_CREDENTIALS_JSON` (or `_FILE`) on the API so `fcm_enabled()` is
  `True`
- Scaffolded `frontend/ios/` with `AppDelegate.swift` that swaps APNs → FCM
  when Firebase is present
- Set `UIBackgroundModes: remote-notification` and privacy strings in
  `Info.plist`

You do **not** need Docker, Django, or Postgres on the Mac. The app is a
WebView over the live production site.

If pushes still never arrive after Phases 1–5, ask the main owner to confirm on
the server:

```bash
docker compose exec -T web python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'luminexa.settings')
django.setup()
from jobs.push_services import fcm_enabled, _ensure_firebase
print('fcm_enabled =', fcm_enabled(), '| initialized =', _ensure_firebase() is not None)
"
```

Both must be `True`.

---

## Phase 1 — Mac machine setup

### 1.1 Install tools

- macOS with **Xcode 15+** (App Store) — open Xcode once and accept the license
- **Node 22** (e.g. from https://nodejs.org or `nvm`)
- Git + SSH key that can clone `git@github.com:deve-lope/luminexa.git`
- Apple ID invited to the **owner’s** Apple Developer team

### 1.2 Clone and sync

```bash
git clone git@github.com:deve-lope/luminexa.git
cd luminexa
git checkout release/store-prep-v1   # or the branch the owner names
cd frontend
npm install
npm run cap:sync:ios
npm run cap:open:ios
```

Notes:

- `npm install` is **required**. Swift packages point into
  `node_modules/@capacitor/...` by relative path.
- `npm run build` is **not** required for sync while `server.url` points at
  production. Sync may warn that `build/` is missing — that is OK.
- Capacitor 8 uses **Swift Package Manager**, not CocoaPods — there is **no**
  `pod install` and **no** `.xcworkspace` to open. Xcode opens
  `frontend/ios/App/App.xcodeproj`.

### 1.3 Confirm the project opens

In Xcode you should see the **App** target, bundle ID `com.luminexa.app`, and
Signing & Capabilities. If packages fail to resolve, re-run `npm install` then
`npm run cap:sync:ios`.

---

## Phase 2 — Apple + Firebase (mostly owner; you need the plist)

### 2.1 Apple Developer (owner)

1. Enrol in the [Apple Developer Program](https://developer.apple.com) ($99/yr)
   under the **business / owner**, not the friend’s personal account.
2. **Users and Access** → invite the **friend’s own Apple ID email**
   (whatever he uses for iCloud — not GitHub, not a shared “same email”).
   - Minimum role: **Developer** (signing)
   - **App Manager** if they also manage TestFlight / listing
3. **Certificates, Identifiers & Profiles** → Identifiers → App ID  
   `com.luminexa.app` with **Push Notifications** enabled
4. **App Store Connect** → create app **Luminexa**, bundle ID
   `com.luminexa.app`

### 2.2 Firebase — add iOS app (owner or friend with Firebase access)

1. Open [Firebase console](https://console.firebase.google.com) → project
   **`luminexa-c7587`** only.
2. **Add app → iOS** → bundle ID `com.luminexa.app` → register.
3. Download **`GoogleService-Info.plist`**.
4. Send that file to the Mac collaborator **out of band** (Signal, 1Password,
   encrypted zip). **Not** git, email, or Slack if avoidable.

### 2.3 APNs auth key (owner — downloads only once)

1. [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list)
   → **+** → enable **Apple Push Notifications service (APNs)**.
2. Download the `.p8`. **Back it up like the Android keystore** — Apple will
   not show it again. Note **Key ID** and **Team ID**.
3. Firebase → Project settings → **Cloud Messaging** → Apple app configuration
   → upload the `.p8` with Key ID + Team ID.

Without step 2.3, the iPhone can register a token and the API can store it, but
**nothing is delivered**.

---

## Phase 3 — Xcode: make push actually work

Do these on the Mac with the project open.

### 3.1 Add `GoogleService-Info.plist`

1. Drag the plist into the **App** group in the Xcode project navigator
   (`frontend/ios/App/App/`).
2. Check **Copy items if needed** and the **App** target.
3. Confirm it appears in **Build Phases → Copy Bundle Resources**.

Copying the file into the folder in Finder alone is **not** enough.

### 3.2 Add Firebase Messaging (Swift Package)

1. **File → Add Package Dependencies…**
2. URL: `https://github.com/firebase/firebase-ios-sdk`
3. Dependency rule: **Up to Next Major** from `12.0.0` (or current stable)
4. Add product **FirebaseMessaging** to the **App** target

`AppDelegate.swift` already contains:

- `FirebaseApp.configure()` when the plist is present
- APNs → FCM token swap before notifying Capacitor

Those blocks are behind `#if canImport(FirebaseCore)`, so they activate
automatically once the package is linked.

### 3.3 Push Notifications capability

1. Select **App** target → **Signing & Capabilities**
2. Choose the owner’s **Team**
3. **+ Capability → Push Notifications**

This creates/updates entitlements. Without it, registration fails silently.

### 3.4 Commit Xcode’s tracked changes

Xcode will modify tracked files. Commit and push them on a branch:

- `frontend/ios/App/App.xcodeproj/project.pbxproj`
- `App.entitlements` (if created)

Do **not** commit `GoogleService-Info.plist`.

---

## Phase 4 — Build, TestFlight, install

1. Device destination: **Any iOS Device (arm64)** (not a simulator for release).
2. **Product → Archive**
3. **Distribute App → App Store Connect → Upload**
4. Wait for processing in App Store Connect / TestFlight (often 10–30 minutes)
5. Add yourself as an internal tester → install **Luminexa** on a **physical
   iPhone**

Bump **Build** (`CURRENT_PROJECT_VERSION`) on every upload; App Store Connect
rejects duplicate build numbers. Marketing version can stay `1.0` until you
ship.

---

## Phase 5 — Prove notifications (same as Android)

### 5.1 On the iPhone

1. Open Luminexa → allow notifications when prompted
2. **Sign in** (token is registered after login)
3. Fully background or swipe away the app
4. Trigger a real event (easiest: invoice payment / “invoice ready”)

You should get a **lock-screen** notification. Tap it and confirm it opens the
right screen when possible.

### 5.2 On the server (owner)

Confirm an iOS token exists (counts only — no secrets):

```bash
cd backend && .venv/bin/python manage.py shell -c "
from django.db.models import Count
from accounts.models import DevicePushToken
print(list(DevicePushToken.objects.values('platform').annotate(n=Count('id')).order_by('platform')))
"
```

You want a non-zero `ios` count after the friend has signed in on a device.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| App builds but never asks for notifications | Push capability missing | Phase 3.3 |
| Permission granted, no token in DB | Not signed in, or Firebase package / plist missing | Sign in; check 3.1–3.2 |
| Token in DB with `platform=ios`, still no lock screen | APNs `.p8` not uploaded to Firebase | Phase 2.3 |
| Token stored, FCM “success”, still nothing | Wrong Firebase project / plist from another project | Must be `luminexa-c7587` |
| Server never sends (Android also broken) | `FIREBASE_CREDENTIALS_*` unset | Phase 0 check on server |
| Tap does nothing useful | Deep link / SPA route — separate from delivery | Confirm banner appears first |
| Declined permission earlier | iOS will not re-prompt | Settings → Luminexa → Notifications → On |
| Simulator “works” in UI but no push | Expected | Use a real iPhone |

---

## What is already in the repo (you should not reinvent)

| Item | Location |
|------|----------|
| Capacitor iOS project | `frontend/ios/` |
| APNs→FCM swap + safe Firebase configure | `frontend/ios/App/App/AppDelegate.swift` |
| Background remote notifications | `Info.plist` → `UIBackgroundModes` |
| Location / camera / photo purpose strings | `Info.plist` |
| SPA registers token after login | `frontend/src/native/capacitorNative.js` |
| FCM send (Android + iOS) | `backend/jobs/push_services.py` |
| Token storage | `accounts.DevicePushToken` |

---

## App Store notes (later)

When submitting for review, Apple is stricter than Play about WebView shells
(Guideline 4.2). Native push + native location/camera use help. Listing
screenshots must be iPhone 6.7" (1290×2796). Account deletion and Stripe for
real-world services are already handled in the product. See
[`CAPACITOR_IOS.md`](CAPACITOR_IOS.md) § App Review.

---

## Quick checklist (print this)

**Owner**

- [ ] Apple Developer team + friend invited  
- [ ] App ID `com.luminexa.app` + Push enabled  
- [ ] App Store Connect app created  
- [ ] Firebase **`luminexa-c7587`** → iOS app added  
- [ ] APNs `.p8` uploaded to Firebase Cloud Messaging  
- [ ] `GoogleService-Info.plist` sent to friend securely  
- [ ] API `fcm_enabled` / initialized both `True`  
- [ ] SPA deployed at `https://app.luminex-a.com`  

**Friend (Mac)**

- [ ] Clone + `npm install` + `cap:sync:ios` + `cap:open:ios`  
- [ ] Plist in App target  
- [ ] FirebaseMessaging package added  
- [ ] Push Notifications capability + Team signing  
- [ ] Archive → TestFlight → install on real iPhone  
- [ ] Allow notifications + sign in  
- [ ] Background app → trigger event → lock-screen push  
- [ ] Commit/push `project.pbxproj` + entitlements (not the plist)  

---

## Contact / ownership

Questions about server Firebase credentials, Android, or the live SPA → main
developer on the Linux host.

Questions about Xcode signing, TestFlight, or device install → Mac
collaborator (this guide).
