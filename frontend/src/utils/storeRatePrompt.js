/** Native Play / App Store “rate Luminexa” prompt (not provider job reviews). */

export const STORAGE_KEY = 'luminexa.storeRatePrompt.v1';
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function readStore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(partial) {
  const next = { ...readStore(), ...partial };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Stamp first native open so we can wait ~1 week before asking. */
export function ensureFirstOpenedAt(now = Date.now()) {
  if (typeof window === 'undefined') return null;
  const store = readStore();
  if (store.firstOpenedAt) return store.firstOpenedAt;
  writeStore({ firstOpenedAt: now });
  return now;
}

export function markStoreRateDismissed(now = Date.now()) {
  writeStore({ dismissedAt: now });
}

export function markStoreRateCompleted(now = Date.now()) {
  writeStore({ completedAt: now });
}

/**
 * Eligible when: native shell, store URL exists, ≥1 week since first open,
 * and user has not dismissed or already opened the store.
 */
export function shouldShowStoreRatePrompt({
  isNative,
  storeUrl,
  now = Date.now(),
} = {}) {
  if (!isNative || !storeUrl) return false;
  const store = readStore();
  if (store.completedAt || store.dismissedAt) return false;
  const first = store.firstOpenedAt;
  if (!first) return false;
  return now - Number(first) >= WEEK_MS;
}
