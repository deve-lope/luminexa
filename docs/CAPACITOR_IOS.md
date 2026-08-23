# Luminexa — Capacitor iOS app

Same shell as Android: a **WebView around `https://app.luminex-a.com`**, package
`com.luminexa.app`. The iOS project lives in `frontend/ios/` and was generated
with `npx cap add ios`.

Capacitor 8 uses **Swift Package Manager**, not CocoaPods, so there is no
`pod install` step and no `Podfile`.

## You need a Mac

The `.ipa` can only be produced by **Xcode**, which is macOS-only. There is no
Linux or Windows path Apple accepts. Everything in `frontend/ios/` is ready —
only the compile, sign, and upload steps must happen on a Mac.

If you don't have one, a hosted macOS runner works (Codemagic, GitHub Actions
`macos-latest`, Bitrise, or an hourly Mac mini from Scaleway / MacStadium).

## One-time Apple setup

1. **Apple Developer Program** — $99/year, enroll at developer.apple.com.
   TestFlight and App Store both require it.
2. **Certificates, Identifiers & Profiles** → register App ID `com.luminexa.app`
   with the **Push Notifications** capability checked.
3. **App Store Connect** → new app, bundle ID `com.luminexa.app`,
   name `Luminexa`, primary language, category (Business or Lifestyle).
4. Listing copy and screenshots can be adapted from
   [`PLAY_CONSOLE_LISTING.md`](PLAY_CONSOLE_LISTING.md); iOS needs its own
   6.7" iPhone screenshots (1290×2796).

## Build for TestFlight

On the Mac, with Node 22 and Xcode 15+ installed:

```bash
cd frontend
npm install
npm run build          # webDir, also the offline fallback
npm run cap:sync:ios   # copies assets + resolves Swift packages
npm run cap:open:ios   # opens App.xcodeproj in Xcode (SPM: no .xcworkspace)
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities**.
2. Set your **Team**; leave signing on *Automatic*.
3. **+ Capability → Push Notifications** (this creates `App.entitlements`;
   without it, push registration silently fails).
4. Device dropdown → **Any iOS Device (arm64)**.
5. **Product → Archive**, then **Distribute App → App Store Connect → Upload**.

The build appears in TestFlight in 10–30 minutes. Add yourself as an internal
tester to install it on a device.

Version is `MARKETING_VERSION = 1.0` / `CURRENT_PROJECT_VERSION = 1`. Bump the
build number on every upload — App Store Connect rejects duplicates.

## Already configured

- `Info.plist` purpose strings for location, camera, and photo library. The SPA
  calls `navigator.geolocation` and uses `<input type="file">`; **iOS kills the
  app** if these strings are missing.
- `ITSAppUsesNonExemptEncryption = false`, so uploads skip the export
  compliance questionnaire.
- `UIBackgroundModes: remote-notification` for pushes while backgrounded.
- iPhone-only (`TARGETED_DEVICE_FAMILY = 1`). The SPA is mobile-first, and
  going universal would put the app in front of an iPad reviewer.
- App icon (1024×1024, no alpha) and splash generated from
  `frontend/public/icons/icon-512.png`.
- `AppDelegate.swift` configures Firebase and swaps the APNs token for an FCM
  token before handing it to the Capacitor bridge (see Push notifications).

## Push notifications

iOS push works through the **same FCM backend as Android** — no API changes.

The catch: `@capacitor/push-notifications` hands back an **APNs** token on iOS,
and FCM only accepts its own registration tokens. `AppDelegate.swift` already
trades one for the other (`Messaging.messaging().apnsToken = deviceToken`, then
posts the FCM token to the Capacitor bridge), so the SPA and
`backend/jobs/push_services.py` need no iOS-specific code.

That swap is wrapped in `#if canImport(FirebaseCore)`, and `FirebaseApp.configure()`
is skipped when `GoogleService-Info.plist` is absent, so **the app builds and runs
without Firebase — pushes just never arrive.** Steps 1–5 below activate it. A
half-finished setup degrades to "no notifications" rather than a launch crash.

### 1. Firebase — add an iOS app

Firebase console → **project `luminexa-c7587`** → **Add app → iOS**, bundle ID
`com.luminexa.app`. Download **`GoogleService-Info.plist`** (gitignored, like
`google-services.json` on Android).

Add it to that existing project — do **not** create a second Firebase project for
iOS. Both platforms must live under `luminexa-c7587` so the one service-account
credential on the API server can push to Android and iOS alike. A key from a
different project looks correctly configured and silently never delivers. The
project ID is also in `frontend/android/app/google-services.json` under
`project_info.project_id` if you need to re-check it.

### 2. Apple — create an APNs auth key

developer.apple.com → Certificates, Identifiers & Profiles → **Keys** → **+** →
check **Apple Push Notifications service (APNs)** → download the `.p8`.

Note the **Key ID** and your **Team ID**. The `.p8` downloads **once** and
cannot be retrieved again — back it up like the Android keystore.

### 3. Firebase — upload the key

Project settings → **Cloud Messaging** → *Apple app configuration* → upload the
`.p8` with its Key ID and Team ID. This is what lets FCM talk to APNs; without
it, tokens register but nothing is delivered.

### 4. Xcode — add the Firebase SDK

1. Drag `GoogleService-Info.plist` into the **App** group in Xcode's sidebar,
   ticking *Copy items if needed* and the **App** target. Copying it into the
   folder is not enough — Xcode has to track the file.
2. **File → Add Package Dependencies** →
   `https://github.com/firebase/firebase-ios-sdk` → *Up to Next Major* from
   `12.0.0` → add the **FirebaseMessaging** product to the **App** target.
3. **Signing & Capabilities → + Capability → Push Notifications**.

`npx cap sync ios` only rewrites `CapApp-SPM/Package.swift`, so a package added
to the App target this way survives future syncs.

### 5. Test on a real device

Simulators do not get reliable FCM tokens. Install on a physical iPhone, accept
the permission prompt, sign in (this is when the token POSTs to
`/accounts/api/push-tokens/`), then background the app and trigger a real event
— an invoice payment is the easiest.

Verify an `ios` token was stored — this counts tokens per platform and prints no
user data:

```bash
cd backend && .venv/bin/python manage.py shell -c "
from django.db.models import Count
from accounts.models import DevicePushToken
print(list(DevicePushToken.objects.values('platform').annotate(n=Count('id')).order_by('platform')))"
```

If nothing arrives, check in this order: `.p8` uploaded to Firebase, Push
Notifications capability present, `GoogleService-Info.plist` in the target, and
`FIREBASE_CREDENTIALS_FILE` set on the API server.

## App Review risks

**Guideline 4.2 (minimum functionality)** is the real one. Because
`capacitor.config.ts` sets `server.url`, 100% of the UI is remote content, and
Apple rejects apps that are "a repackaged website". Android/Play tolerates this;
Apple frequently does not. What helps:

- Native push notifications and native location/camera use (this is why the
  Firebase work above matters for approval, not just for features).
- Bundling the SPA in the app instead of `server.url`. Note this moves the
  origin to `capacitor://localhost`, so the session cookie stops being
  same-origin — the API would need `SameSite=None; Secure` cookies plus CORS
  with credentials. Non-trivial; decide before submitting.

Non-issues, already satisfied:

- **3.1.1 in-app purchase** — bookings are real-world physical services, which
  are exempt, so Stripe is allowed.
- **5.1.1(v) account deletion** — `DeleteAccountPage.js` already provides it.
- **Sign in with Apple** — only required alongside third-party social login,
  and Luminexa is email/password only.

## After install

Sign in and confirm the session persists across app restarts. Check that
"use my location" prompts once and that profile photo upload can reach both the
camera and the photo library.
