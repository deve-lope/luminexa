/**
 * Persist referral codes from ?ref= so they survive login / navigation
 * until the customer books with that provider.
 */
const storageKey = (orgKey) => `lx_referral_${String(orgKey || '').toLowerCase()}`;

export function captureReferralFromSearch(search, orgKeys = []) {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(search || window.location.search || '');
  const ref = (params.get('ref') || '').trim().toUpperCase();
  if (!ref) return null;
  const keys = (orgKeys || []).filter(Boolean);
  if (!keys.length && typeof window !== 'undefined') {
    // Still store under a generic pending key if slug unknown yet
    try {
      sessionStorage.setItem('lx_referral_pending', ref);
    } catch {
      /* ignore */
    }
    return ref;
  }
  keys.forEach((key) => {
    try {
      sessionStorage.setItem(storageKey(key), ref);
    } catch {
      /* ignore */
    }
  });
  try {
    sessionStorage.removeItem('lx_referral_pending');
  } catch {
    /* ignore */
  }
  return ref;
}

export function getStoredReferralCode(...orgKeys) {
  if (typeof window === 'undefined') return '';
  for (const key of orgKeys.filter(Boolean)) {
    try {
      const v = sessionStorage.getItem(storageKey(key));
      if (v) return v;
    } catch {
      /* ignore */
    }
  }
  try {
    return sessionStorage.getItem('lx_referral_pending') || '';
  } catch {
    return '';
  }
}

export function clearStoredReferralCode(...orgKeys) {
  if (typeof window === 'undefined') return;
  orgKeys.filter(Boolean).forEach((key) => {
    try {
      sessionStorage.removeItem(storageKey(key));
    } catch {
      /* ignore */
    }
  });
  try {
    sessionStorage.removeItem('lx_referral_pending');
  } catch {
    /* ignore */
  }
}

export function buildReferralShareUrl(bookingUrl, code) {
  if (!bookingUrl || !code) return bookingUrl || '';
  const sep = bookingUrl.includes('?') ? '&' : '?';
  return `${bookingUrl}${sep}ref=${encodeURIComponent(code)}`;
}
