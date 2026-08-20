export const RATE_PROMPT_EVENT = 'luminexa:prompt-rate-booking';
const STORAGE_KEY = 'luminexa.ratePrompt.v1';
const PENDING_KEY = 'luminexa.pendingRateBookingId';

export function localDateKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readStore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function isPaidCompletedBooking(booking) {
  return (
    booking?.status === 'completed' &&
    booking?.can_rate &&
    booking?.invoice?.status === 'paid'
  );
}

/** After pay, or on a later app open if they skipped rating that day. */
export function shouldPromptRate(booking, now = new Date()) {
  if (!isPaidCompletedBooking(booking)) return false;
  const row = readStore()[String(booking.id)];
  if (!row) return true;
  if (row.rated) return false;
  const today = localDateKey(now);
  if (row.firstShownOn === today) return false;
  if (row.reminderShown) return false;
  return true;
}

export function markRatePromptShown(bookingId, now = new Date()) {
  if (bookingId == null) return;
  const id = String(bookingId);
  const store = readStore();
  const today = localDateKey(now);
  const prev = store[id] || {};
  if (prev.rated) return;
  if (!prev.firstShownOn) {
    store[id] = { firstShownOn: today, reminderShown: false };
  } else if (prev.firstShownOn !== today) {
    store[id] = { ...prev, reminderShown: true };
  }
  writeStore(store);
}

export function markRatePromptRated(bookingId) {
  if (bookingId == null) return;
  const store = readStore();
  store[String(bookingId)] = { ...(store[String(bookingId)] || {}), rated: true };
  writeStore(store);
}

export function requestRatePrompt(bookingId) {
  if (bookingId == null || typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_KEY, String(bookingId));
  window.dispatchEvent(
    new CustomEvent(RATE_PROMPT_EVENT, { detail: { bookingId: String(bookingId) } }),
  );
}

export function consumePendingRatePrompt() {
  if (typeof window === 'undefined') return null;
  const id = window.sessionStorage.getItem(PENDING_KEY);
  if (id) window.sessionStorage.removeItem(PENDING_KEY);
  return id;
}

export function pickRatePromptBooking(bookings, now = new Date()) {
  return (bookings || []).find((b) => shouldPromptRate(b, now)) || null;
}
