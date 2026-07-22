# Luminexa — TWA / Android build guide

This is the repeatable path for wrapping the live PWA at
`https://app.luminex-a.com/` as an Android Trusted Web Activity (TWA).

Use this after the Play Console app exists.

---

## Fixed app identity

Choose once and do not change after the first Play upload:

| Field | Value |
|-------|-------|
| App name | Luminexa |
| Package / application ID | `com.luminexa.app` |
| Web manifest | `https://app.luminex-a.com/manifest.json` |
| Start URL | `https://app.luminex-a.com/` |

---

## Prerequisites

Bubblewrap requires Java / Android build tooling. On this machine, `java` was
not installed when this guide was written, so Bubblewrap setup will prompt to
install a JDK.

```bash
cd /home/ajil/luminexa
npx @bubblewrap/cli --help
```

If Bubblewrap asks:

```text
Do you want Bubblewrap to install the JDK (recommended)?
```

Choose **Yes** unless you have already installed JDK 17 yourself.

---

## Initialize the Android project

Run this in an empty output directory so generated Android files stay separate
from the web app:

```bash
cd /home/ajil/luminexa
mkdir -p android-twa
cd android-twa
npx @bubblewrap/cli init --manifest https://app.luminex-a.com/manifest.json
```

Recommended answers:

| Prompt | Answer |
|--------|--------|
| Application name | `Luminexa` |
| Short name | `Luminexa` |
| Application ID / Package name | `com.luminexa.app` |
| Display mode | `standalone` |
| Orientation | `portrait-primary` (or default from manifest) |
| Status bar color | `#0D9488` |
| Navigation bar color | `#10231F` |

Bubblewrap creates `twa-manifest.json`. Keep that file. It is the source for
regenerating/updating the Android project.

---

## Signing key

Play requires a signed Android App Bundle (`.aab`). The signing key is sensitive.

Rules:

- Do **not** commit `.jks`, `.keystore`, passwords, or generated signed bundles.
- Back up the keystore offline.
- Use a password manager for keystore/key passwords.
- Enroll in Play App Signing in Play Console.

If Bubblewrap generates a key, record where it saved it and keep it out of git.

---

## Build

From `android-twa/` after `init` succeeds:

```bash
npx @bubblewrap/cli build
```

Expected output includes:

- `app-release-bundle.aab` — upload this to Play Console Internal testing
- a signed APK for local device testing (name may vary)

---

## Digital Asset Links

After the signed app exists, get the Android signing certificate SHA-256
fingerprint from Bubblewrap output or Play Console.

Then create:

```text
frontend/public/.well-known/assetlinks.json
```

Use the template in `docs/assetlinks.template.json` and replace:

```text
REPLACE_WITH_SHA256_FINGERPRINT
```

with the real fingerprint.

Then rebuild the frontend Docker container so this URL works:

```text
https://app.luminex-a.com/.well-known/assetlinks.json
```

Without a valid assetlinks file, the TWA will show browser UI instead of opening
fully trusted/full-screen.

---

## Internal testing smoke test

After uploading the AAB to Play Internal testing:

1. Install from the tester link on an Android device.
2. Launch Luminexa.
3. Confirm it opens full-screen without a browser address bar.
4. Sign in / sign out.
5. Search by ZIP/address and radius.
6. Open a provider and check booking calendar.
7. Confirm the privacy policy link opens: `https://app.luminex-a.com/privacy`.

