# Luminexa — Capacitor Android app

This is a **WebView shell** around the live site `https://app.luminex-a.com`.
It is not a Kotlin rewrite. Login uses the same website session, stored in the
app WebView (not Chrome).

Package ID stays `com.luminexa.app` so you can replace the TWA on Play.

## What you get

- Full-screen app (no Chrome address bar)
- Isolated login: **Settings → Apps → Luminexa → Clear data** signs you out
- Android 13+ **notification permission** prompt on first open
- Same UI as the website

Lock-screen **push** (bill ready / payment) still needs Firebase later:
put `google-services.json` in `frontend/android/app/` and we can send FCM.

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
The first launch should ask for notifications (Android 13+).
