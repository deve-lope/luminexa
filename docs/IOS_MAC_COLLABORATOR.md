# Luminexa — iOS work on a collaborator's Mac

**Start here for the full friend handoff (phases + push like Android):**
[`IOS_HELP_GUIDE.md`](IOS_HELP_GUIDE.md).

How a second developer with a Mac builds, signs, and ships the iOS app while the
main developer keeps working on the Linux server. Build steps themselves live in
[`CAPACITOR_IOS.md`](CAPACITOR_IOS.md); this file covers the **two-machine split**.

## Why SSH into the Linux server does not work

Xcode is macOS-only: it cannot be installed on the Linux host, and code signing,
`Archive`, and TestFlight upload all run inside it. SSHing into the server only
gives a shell on a machine that has no Xcode, so the Mac needs its own git
checkout and its own `node_modules`. Everything else — Django, Postgres, Docker —
stays on the server and is never needed on the Mac.

## Prerequisite (Linux side, once)

`frontend/ios/` and `docs/CAPACITOR_IOS.md` must be **committed and pushed** to
`origin` (`git@github.com:deve-lope/luminexa.git`) before the Mac clone, or the
friend gets a repo with no iOS project.

## Mac setup

Needs only: git, **Node 22**, **Xcode 15+**. No backend, no Docker, no database.

```bash
git clone git@github.com:deve-lope/luminexa.git
cd luminexa
git checkout release/store-prep-v1
cd frontend
npm install            # required — Package.swift resolves plugins from node_modules
npx cap sync ios       # copies config, regenerates CapApp-SPM/Package.swift
npx cap open ios       # opens ios/App/App.xcodeproj
```

`npm install` is **not optional**: `ios/App/CapApp-SPM/Package.swift` points at
`../../../node_modules/@capacitor/...` by relative path, so Xcode fails to
resolve packages without it.

### Is `npm run build` required first?

**No.** `capacitor.config.ts` sets `server.url`, so `cap sync ios` prints a
warning and exits 0 when `frontend/build/` is absent:

```
[warn] Cannot copy web assets from build to ios/App/App/public
       Web asset directory specified by webDir does not exist. This is not an
       error because server.url is set in config.
```

`frontend/build/` is gitignored, so a fresh clone never has it. `cap sync` still
creates `ios/App/App/public/` with `cordova.js` stubs, which is what the Xcode
folder reference needs, so the Xcode build is not broken either. Run
`npm run build` only if you want real bundled assets in `public/`; the running
app loads `https://app.luminex-a.com` regardless.

## Division of labour

| Task | Where |
|------|-------|
| SPA / Django code, migrations, deploy to `app.luminex-a.com` | Linux server (main dev) |
| Backend `FIREBASE_CREDENTIALS_*`, Firebase service account | Linux server (main dev) |
| Android AAB / Play Console | Linux server (main dev) |
| Xcode signing, capabilities, Archive, TestFlight/App Store upload | Mac (friend) |
| Firebase iOS app + `GoogleService-Info.plist` placement | Mac (friend) |
| APNs `.p8` creation and upload to Firebase | either — see below |

Because the app is a WebView over the live SPA, the friend sees **production**
UI changes as soon as the main dev deploys them. He never rebuilds the app for a
JS change — only for native config, icons, or a version bump.

## Secrets to hand over out of band

Never committed; `.gitignore` already blocks all of these.

| File | Who needs it | How |
|------|--------------|-----|
| `GoogleService-Info.plist` | Mac, into `frontend/ios/App/App/` | password-manager share, Signal, or encrypted zip — not email/Slack |
| APNs auth key `AuthKey_XXXX.p8` | whoever uploads it to Firebase | same; **downloads once from Apple and can never be re-downloaded** — back it up like the Android keystore |
| Firebase service-account JSON | Linux server only | never send to the Mac |

Simplest split: the main dev creates the `.p8` and uploads it to Firebase
himself, then only `GoogleService-Info.plist` has to travel.

## Apple account model

Enrol **the main dev / the business** in the Apple Developer Program ($99/yr),
then invite the friend into that team:

1. App Store Connect → **Users and Access** → **+** → invite **his own Apple
   ID email** (any email he already uses for iCloud). GitHub (`deve-lope`) and
   the owner’s git email (`ajil@luminexa.com`) are **not** his Apple ID unless
   he happens to use the same address for Apple — they do not have to match.
2. Role: **Developer** at minimum — that is what grants signing certificates and
   provisioning profiles. **App Manager** if he should also manage TestFlight and
   the listing. **Admin** only if he needs to manage users too.
3. He signs into Xcode with **his** Apple ID and picks the shared **Team** under
   Signing & Capabilities. He must not enrol a second $99 program or publish as
   himself.

Do **not** let him publish under his own personal Apple Developer Program. The app record,
the listing, and the Apple relationship would belong to him, and moving an app
between Apple accounts later is a manual transfer that fails if there are
outstanding agreements or an active subscription.

## Git workflow

1. Friend branches off `release/store-prep-v1`, does the Xcode work, commits,
   pushes.
2. Main dev pulls on the Linux server. `npx cap sync ios` on Linux stays safe —
   it only rewrites generated files.

Xcode **will** modify `frontend/ios/App/App.xcodeproj/project.pbxproj` when he
adds the Firebase package and the Push Notifications capability, and it also
creates `App/App.entitlements`. Both are **tracked** — commit and push them, or
the server's tree drifts and the next `cap sync` diff is confusing.

Gitignored under `frontend/ios/` — do not try to commit these:

| Path | Why |
|------|-----|
| `App/App/GoogleService-Info.plist` | secret |
| `App/App/public/` | generated by `cap copy` |
| `App/App/capacitor.config.json`, `App/App/config.xml` | generated by `cap sync` |
| `App/build/`, `DerivedData/`, `xcuserdata/` | local build output |
| `*.ipa`, `*.xcarchive`, `*.p8`, `*.p12`, `*.mobileprovision` | outputs / secrets |

## Background push chain

Notifications must arrive with the app backgrounded or killed. Delivery is done
by **APNs**, not by the app, so a closed app is the normal case — nothing in the
app has to be running. Every link below must hold:

| Link | Owner | Status |
|------|-------|--------|
| `FIREBASE_CREDENTIALS_FILE` or `FIREBASE_CREDENTIALS_JSON` set on the API server | Linux | **must be set** — `fcm_enabled()` in `backend/jobs/push_services.py` returns `False` otherwise and every send is a silent no-op |
| `firebase-admin` installed on the API server | Linux | in `backend/requirements.txt` and `requirements-prod.txt` (`6.6.0`) |
| APNs `.p8` uploaded to Firebase → Cloud Messaging → Apple app configuration | either | required — without it FCM cannot reach APNs and tokens register but nothing is delivered |
| APNs payload names a sound | — | done: `push_services.py` sends `APNSConfig(headers={'apns-priority': '10'}, aps=Aps(sound='default'))` |
| `UIBackgroundModes: remote-notification` | — | done in `frontend/ios/App/App/Info.plist` |
| Push Notifications capability in Xcode | Mac | **must be added** — creates `App.entitlements`; without it registration silently fails |
| `GoogleService-Info.plist` added to the **App target** (not just copied into the folder) | Mac | required — `AppDelegate.swift` skips `FirebaseApp.configure()` when it is absent |

Two genuine caveats:

- iOS shows the permission prompt once. If the user declines, nothing arrives
  until they re-enable it in **Settings → Luminexa → Notifications**.
- Test on a **physical iPhone**. Simulators do not get reliable FCM tokens.

## Who does what — end-to-end checklist

| # | Step | Main dev (Linux) | Friend (Mac) |
|---|------|------------------|--------------|
| 1 | Push `frontend/ios/` to `origin` | ✅ | |
| 2 | Enrol in Apple Developer Program | ✅ | |
| 3 | Invite friend to the team (Developer / App Manager) | ✅ | |
| 4 | Register App ID `com.luminexa.app` with Push Notifications | ✅ | |
| 5 | Create App Store Connect app record + listing | ✅ | |
| 6 | Firebase → add iOS app, download `GoogleService-Info.plist` | ✅ | |
| 7 | Create APNs `.p8`, upload to Firebase Cloud Messaging | ✅ | |
| 8 | Send `GoogleService-Info.plist` out of band | ✅ | |
| 9 | Set `FIREBASE_CREDENTIALS_*` on the API server, restart Django | ✅ | |
| 10 | Deploy SPA so the WebView serves current JS | ✅ | |
| 11 | Clone, `npm install`, `cap sync ios`, `cap open ios` | | ✅ |
| 12 | Add `GoogleService-Info.plist` to the App target | | ✅ |
| 13 | Add `firebase-ios-sdk` package → FirebaseMessaging | | ✅ |
| 14 | Signing & Capabilities → Team + Push Notifications | | ✅ |
| 15 | Archive → Distribute → TestFlight | | ✅ |
| 16 | Commit `project.pbxproj` + `App.entitlements`, push branch | | ✅ |
| 17 | Install on a real iPhone, grant notifications, sign in | | ✅ |
| 18 | Trigger an invoice payment, confirm lock-screen push | ✅ | ✅ |
| 19 | Verify token stored with `platform='ios'` (query in `CAPACITOR_IOS.md`) | ✅ | |
