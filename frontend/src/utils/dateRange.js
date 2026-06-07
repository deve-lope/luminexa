/** Local-date helpers (avoid UTC shift from toISOString). */

export function formatLocalDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDateKey(key) {
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysToKey(key, days) {
  const d = parseLocalDateKey(key);
  if (!d) return key;
  d.setDate(d.getDate() + days);
  return formatLocalDateKey(d);
}

export function daysBetweenKeys(startKey, endKey) {
  const a = parseLocalDateKey(startKey);
  const b = parseLocalDateKey(endKey);
  if (!a || !b) return 0;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function compareDateKeys(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isDateKeyInRange(key, startKey, endKey) {
  if (!startKey || !endKey) return false;
  const lo = startKey <= endKey ? startKey : endKey;
  const hi = startKey <= endKey ? endKey : startKey;
  return key >= lo && key <= hi;
}

export function todayKey() {
  return formatLocalDateKey(new Date());
}
