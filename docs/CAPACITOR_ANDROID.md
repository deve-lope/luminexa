# Luminexa — Capacitor Android app

This is a **WebView shell** around the live site `https://app.luminex-a.com`.
It is not a Kotlin rewrite. Login uses the same website session, stored in the
app WebView (not Chrome).

Package ID stays `com.luminexa.app` so you can replace the TWA on Play.

## What you get

- Full-screen app (no Chrome address bar)
- Isolated login: **Settings → Apps → Luminexa → Clear data** signs you out
- Android 13+ **notification permission** prompt on first open
- Device token saved to `/accounts/api/push-tokens/` after login
- Outside-app pushes when Firebase is configured (invoice ready, payment, new booking, cancel)

## Firebase (required for lock-screen push)

1. Create a Firebase project → add Android app `com.luminexa.app`.
2. Download **`google-services.json`** into `frontend/android/app/` (gitignored).
3. Project settings → Service accounts → Generate new private key (JSON).
4. On the **API server**, set one of:
   - `FIREBASE_CREDENTIALS_FILE=/path/to/service-account.json`
   - or `FIREBASE_CREDENTIALS_JSON='{...}'` (single-line JSON)
5. Rebuild/restart Django (`web` + celery if used) after installing `firebase-admin`.
6. Rebuild the Capacitor AAB so `google-services.json` is in the app.

Without credentials, the API still accepts tokens but **does not send** pushes;
the `web` log carries one `push notifications are being dropped` warning per
process.

Confirm credentials are live (prints no secrets and no user data):

```bash
docker compose exec -T web python -c "
import os, django; os.environ.setdefault('DJANGO_SETTINGS_MODULE','luminexa.settings'); django.setup()
from jobs.push_services import fcm_enabled, _ensure_firebase
print('fcm_enabled =', fcm_enabled(), '| initialized =', _ensure_firebase() is not None)"
```

Both must be `True`. `fcm_enabled = True` with `initialized = False` means the
credentials were found but **rejected** — check the logs for
`Failed to initialize Firebase for FCM`.

## Build the Play bundle (.aab)

This machine needs **JDK 17** and **Android Studio** (SDK).

```bash
cd /home/ajil/luminexa/frontend
npx cap sync android
npx cap open android
```

In Android Studio:

1. **Build → Generate Signed App Bundle / APK**
2. Sign with the **same upload keystore** you used for the TWA
3. Upload `app-release.aab` to Play **Internal testing** (versionCode is **3** / 1.1.0)

Do not upload an APK if Play asks for an AAB.

## After install

Uninstall the old TWA first, then install from the **tester opt-in link**.
The first launch should ask for notifications (Android 13+). Sign in so the
device token is registered. Then complete a test invoice payment to verify a
lock-screen push.
