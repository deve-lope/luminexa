# Luminexa — Play Store release checklist

Luminexa is a **React SPA + Django API**, not a native Android app yet. Play distribution is via a **Trusted Web Activity (TWA)** / PWA wrapper (Bubblewrap or PWABuilder), not a full Capacitor/React Native rewrite unless product later chooses that path.

---

## 1. Production HTTPS (required before TWA)

- [x] Public SPA on HTTPS: https://app.luminex-a.com/
- [x] API on HTTPS via same-origin nginx proxy (`/api/`, `/accounts/`)
- [x] `REACT_APP_API_URL` uses same-origin on `*.luminex-a.com`
- [x] Service worker: `frontend/public/sw.js` (registers off localhost via `src/index.js`)
- [x] Web app manifest + icons: `frontend/public/manifest.json`, `frontend/public/icons/icon-{192,512}.png`
- [x] Digital Asset Links file published: `/.well-known/assetlinks.json` (upload-key SHA-256; add Play App Signing cert after first upload)
- [x] Privacy policy live: https://app.luminex-a.com/privacy
- [x] Play Console listing draft: [`docs/PLAY_CONSOLE_LISTING.md`](PLAY_CONSOLE_LISTING.md) (paste into Console; you create the app)

Without HTTPS + Asset Links, Play’s TWA will show the browser bar or fail verification.

---

## 2. Wrap as PWA / TWA

Pick one toolchain and stick to it for the release:

| Tool | Role |
|------|------|
| **Bubblewrap** (Google) | CLI: generate Android project from manifest URL |
| **PWABuilder** | Guided packaging + Play package helpers |

Recommended path: Bubblewrap. See [`docs/TWA_BUILD.md`](TWA_BUILD.md).

Checklist:

- [x] Confirm PWA basics: manifest + service worker + icons + screenshots are present
- [x] TWA build guide prepared: [`docs/TWA_BUILD.md`](TWA_BUILD.md)
- [x] Package ID / applicationId chosen: `com.luminexa.app`
- [x] Generate Android package (Bubblewrap): `android-twa/app-release-bundle.aab` (gitignored)
- [x] Signing keystore backed up offline (add Play App Signing when Console is available)
- [x] Upload-key fingerprint live at `/.well-known/assetlinks.json` (add Play App Signing cert after first upload)
- [ ] Smoke-test on a device: opens full-screen, login/booking against production API

---

## 3. Play Console

- [ ] Create app listing (name, default language)
- [x] Store listing assets/copy prepared in repo (`docs/PLAY_CONSOLE_LISTING.md`, `frontend/public/play/`)
- [x] **Privacy policy** URL available (paste in Console): https://app.luminex-a.com/privacy
- [ ] Complete **Store listing** in Play Console (manual account step)
- [ ] **Data safety** form in Play Console: use `docs/PLAY_CONSOLE_LISTING.md`
- [ ] Content rating questionnaire
- [ ] Target audience / news apps declarations as applicable
- [ ] Countries / pricing (free vs paid)

---

## 4. Release tracks

1. **Internal testing** — upload AAB, add testers, verify install + auth + find/book flows
2. **Closed / open testing** (optional) — broader feedback
3. **Production** — staged rollout if desired (e.g. 20% → 100%)

Before production:

- [x] Production API and SPA URLs final (`https://app.luminex-a.com/`, same-origin API proxy)
- [ ] No debug logging of tokens
- [ ] Crash/ANR and basic analytics (if any) acceptable
- [ ] Support contact email on listing

## 5. Current blockers

These steps require user-owned accounts or generated signing material and cannot be completed from the repo alone:

1. Create the Play Console app in the owner Google account.
2. Generate/sign the TWA AAB with Bubblewrap or PWABuilder.
3. Get the Android signing certificate SHA-256 fingerprint.
4. Publish `/.well-known/assetlinks.json` using `docs/assetlinks.template.json`.
5. Upload the signed AAB to Internal testing.

---

## 6. Luminexa-specific notes

- Customer **location** (ZIP / lat-lng) is core to search — Data safety must mention location if collected or approximate location used.
- Auth is account-based (email/phone flows as implemented) — declare account info accordingly.
- Media/uploads (gallery, etc.) — declare photos/files if providers upload images.
- Backend admin and provider dashboard are the same web app origin in typical deploys; TWA usually launches the customer-facing start URL — confirm `start_url` is intentional.

---

## 7. What this doc is not

- Not a guide to rewrite Luminexa in Kotlin/Jetpack Compose
- Not a substitute for Google Play policy review — re-check Play policies near submit time
