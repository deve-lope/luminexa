/** Minimum characters before address autocomplete runs (non-numeric). */
export const ADDRESS_SEARCH_MIN_CHARS = 2;

/** Debounce between keystrokes and API call (ms). */
export const ADDRESS_SEARCH_DEBOUNCE_MS = 100;

/**
 * Whether the current input should trigger a search.
 * Fires from 2+ characters, or from 1+ when the user just typed a space (word break).
 */
export function shouldSearchAddressQuery(raw) {
  const value = raw || '';
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/\s$/.test(value)) return true;
  if (/^\d+$/.test(trimmed) && trimmed.length >= 1) return true;
  return trimmed.length >= ADDRESS_SEARCH_MIN_CHARS;
}

/** Normalized term sent to the API. */
export function addressSearchTerm(raw) {
  return (raw || '').trim();
}

/**
 * Shorter debounce when a word is completed (trailing space) or only 1–2 chars typed.
 */
export function addressSearchDebounceMs(raw) {
  const value = raw || '';
  const trimmed = value.trim();
  if (!trimmed) return ADDRESS_SEARCH_DEBOUNCE_MS;
  if (/\s$/.test(value)) return 0;
  if (trimmed.length <= 2) return 0;
  return ADDRESS_SEARCH_DEBOUNCE_MS;
}
