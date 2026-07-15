# Luminexa — Play Store release checklist

Luminexa is a **React SPA + Django API**, not a native Android app yet. Play distribution is via a **Trusted Web Activity (TWA)** / PWA wrapper (Bubblewrap or PWABuilder), not a full Capacitor/React Native rewrite unless product later chooses that path.

---

## 1. Production HTTPS (required before TWA)

- [ ] Public SPA on HTTPS (valid cert; no mixed content)
- [ ] API on HTTPS; CORS and cookie/auth settings match production origins
- [ ] `REACT_APP_API_URL` (or equivalent) points at production API
- [x] Service worker: `frontend/public/sw.js` (registers off localhost via `src/index.js`)
- [x] Web app manifest + icons: `frontend/public/manifest.json`, `frontend/public/icons/icon-{192,512}.png`
- [ ] Digital Asset Links ready: `/.well-known/assetlinks.json` on the **same domain** the TWA will open
- [x] Privacy policy live: https://app.luminex-a.com/privacy
- [ ] Play Console listing draft: [`docs/PLAY_CONSOLE_LISTING.md`](PLAY_CONSOLE_LISTING.md) (paste into Console; you create the app)

Without HTTPS + Asset Links, Play’s TWA will show the browser bar or fail verification.

---

## 2. Wrap as PWA / TWA

Pick one toolchain and stick to it for the release:

| Tool | Role |
|------|------|
| **Bubblewrap** (Google) | CLI: generate Android project from manifest URL |
| **PWABuilder** | Guided packaging + Play package helpers |

Checklist:

- [ ] Confirm Lighthouse / installability: manifest + service worker + icons
- [ ] Generate Android package (Bubblewrap `init` / PWABuilder Android package)
- [ ] Package ID / applicationId stable (do not change after first upload)
- [ ] Signing keystore backed up offline; Play App Signing enrolled
- [ ] `assetlinks.json` includes the Play app’s SHA-256 cert fingerprint(s)
- [ ] Smoke-test on a device: opens full-screen, login/booking against production API

---

## 3. Play Console

- [ ] Create app listing (name, default language)
- [ ] Complete **Store listing**: short/full description, screenshots (phone; tablet if claiming), feature graphic, icon
- [ ] **Privacy policy** URL (live HTTPS page)
- [ ] **Data safety** form: declare data collected (account, location, bookings), sharing, encryption in transit, deletion
- [ ] Content rating questionnaire
- [ ] Target audience / news apps declarations as applicable
- [ ] Countries / pricing (free vs paid)

---

## 4. Release tracks

1. **Internal testing** — upload AAB, add testers, verify install + auth + find/book flows
2. **Closed / open testing** (optional) — broader feedback
3. **Production** — staged rollout if desired (e.g. 20% → 100%)

Before production:

- [ ] Production API and SPA URLs final
- [ ] No debug logging of tokens
- [ ] Crash/ANR and basic analytics (if any) acceptable
- [ ] Support contact email on listing

---

## 5. Luminexa-specific notes

- Customer **location** (ZIP / lat-lng) is core to search — Data safety must mention location if collected or approximate location used.
- Auth is account-based (email/phone flows as implemented) — declare account info accordingly.
- Media/uploads (gallery, etc.) — declare photos/files if providers upload images.
- Backend admin and provider dashboard are the same web app origin in typical deploys; TWA usually launches the customer-facing start URL — confirm `start_url` is intentional.

---

## 6. What this doc is not

- Not a guide to rewrite Luminexa in Kotlin/Jetpack Compose
- Not a substitute for Google Play policy review — re-check Play policies near submit time
