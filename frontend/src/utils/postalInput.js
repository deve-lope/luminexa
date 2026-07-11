/** Normalize postal / ZIP input for search and API calls. */
export function normalizePostalInput(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

/** Display Canadian postal codes as A1A 1A1; leave US ZIPs as-is. */
export function formatPostalLabel(code) {
  const raw = normalizePostalInput(code);
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(raw)) {
    return `${raw.slice(0, 3)} ${raw.slice(3)}`;
  }
  return raw;
}

function isCanadianPostalPattern(normalized) {
  return /^[A-Z]\d[A-Z](\d[A-Z]\d)?$/.test(normalized);
}

function resolvePostalCountry(country, normalized) {
  const name = String(country || '').trim();
  if (name === 'Canada' || name === 'United States' || name === 'Mexico' || name === 'Brazil') {
    return name;
  }
  if (isCanadianPostalPattern(normalized)) return 'Canada';
  if (/^\d{5}(\d{4})?$/.test(normalized)) return 'United States';
  if (/^\d{8}$/.test(normalized)) return 'Brazil';
  return name;
}

/**
 * Validate a postal / ZIP code.
 * mode: 'complete' for address forms, 'search' allows partial codes for area lookup.
 */
export function validatePostalCode(value, { country = '', mode = 'complete' } = {}) {
  const normalized = normalizePostalInput(value);

  if (!normalized) {
    return { valid: false, error: 'Postal code is required.', normalized: '' };
  }

  if (!/^[A-Z0-9]+$/.test(normalized)) {
    return {
      valid: false,
      error: 'Use only letters and numbers in the postal code.',
      normalized,
    };
  }

  if (normalized.length > 10) {
    return { valid: false, error: 'Postal code is too long.', normalized };
  }

  const region = resolvePostalCountry(country, normalized);

  if (region === 'Canada') {
    if (mode === 'search' && /^[A-Z]\d[A-Z]$/.test(normalized)) {
      return { valid: true, error: null, normalized };
    }
    if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(normalized)) {
      return {
        valid: false,
        error: 'Enter a valid Canadian postal code (e.g. M5V 2T6).',
        normalized,
      };
    }
    return { valid: true, error: null, normalized };
  }

  if (region === 'United States') {
    if (!/^\d{5}(\d{4})?$/.test(normalized)) {
      return {
        valid: false,
        error: 'Enter a valid US ZIP code (5 or 9 digits).',
        normalized,
      };
    }
    return { valid: true, error: null, normalized };
  }

  if (region === 'Mexico') {
    if (!/^\d{5}$/.test(normalized)) {
      return {
        valid: false,
        error: 'Enter a valid 5-digit Mexican postal code.',
        normalized,
      };
    }
    return { valid: true, error: null, normalized };
  }

  if (region === 'Brazil') {
    if (!/^\d{8}$/.test(normalized)) {
      return {
        valid: false,
        error: 'Enter a valid 8-digit Brazilian CEP code.',
        normalized,
      };
    }
    return { valid: true, error: null, normalized };
  }

  if (mode === 'search') {
    if (isPostalSearchReady(normalized)) {
      return { valid: true, error: null, normalized };
    }
    if (normalized.length < 3) {
      return { valid: true, error: null, normalized };
    }
    return {
      valid: false,
      error: 'Enter a valid ZIP or postal code.',
      normalized,
    };
  }

  if (normalized.length < 5) {
    return {
      valid: false,
      error: 'Enter a complete postal code.',
      normalized,
    };
  }

  return { valid: true, error: null, normalized };
}

export function isPostalSearchReady(postal) {
  const p = normalizePostalInput(postal);
  if (/^[A-Z]\d[A-Z]$/.test(p)) return true;
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(p)) return true;
  if (/^\d{5}$/.test(p)) return true;
  if (/^\d{9}$/.test(p)) return true;
  if (/^\d{8}$/.test(p)) return true;
  return p.length >= 5;
}
