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
 * Infer country from typed address / postal text so en-US browsers in Canada
 * still get Canadian results when the query looks Canadian.
 */
export function guessCountryFromAddressQuery(raw) {
  const q = (raw || '').trim();
  if (!q) return '';
  const lowered = q.toLowerCase();

  if (/\bcanada\b/.test(lowered)) return 'Canada';
  if (/\bunited states\b|\busa\b|\bu\.s\.a\b/.test(lowered)) return 'United States';
  if (/\bmexico\b|\bméxico\b/.test(lowered)) return 'Mexico';
  if (/\bbrazil\b|\bbrasil\b/.test(lowered)) return 'Brazil';

  // Canadian postal / FSA
  if (/\b[A-Za-z]\d[A-Za-z](?:\s?\d[A-Za-z]\d)?\b/.test(q)) return 'Canada';
  // US ZIP
  if (/\b\d{5}(?:-\d{4})?\b/.test(q)) return 'United States';

  if (
    /\b(ON|BC|AB|MB|SK|NS|NB|NL|PE|QC|YT|NU|NT|Ontario|Quebec|Québec|British Columbia|Alberta|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Newfoundland|Yukon|Nunavut)\b/i.test(
      q
    )
  ) {
    return 'Canada';
  }

  if (
    /\b(California|Texas|Florida|New York|Illinois|Washington|Arizona|Colorado|Georgia|Ohio|Pennsylvania|Michigan)\b/i.test(
      q
    )
  ) {
    return 'United States';
  }

  return '';
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
