import {
  resolveCustomerBack,
  resolveProviderBack,
  resolvePublicBack,
} from './navigationBack';
import {
  consumePreviousInAppPath,
  locationEntry,
} from './inAppNavStack';

/** @type {Set<() => void>} */
const overlayClosers = new Set();

/** Register a full-screen overlay; back should close it before leaving the page. */
export function registerOverlayCloser(close) {
  if (typeof close !== 'function') return () => {};
  overlayClosers.add(close);
  return () => overlayClosers.delete(close);
}

export function closeTopOverlay() {
  const closers = [...overlayClosers];
  if (!closers.length) return false;
  closers[closers.length - 1]();
  return true;
}

export function resolveAppBackFallback(pathname, search = '') {
  if (pathname.startsWith('/provider/')) {
    const orgSlug = pathname.split('/')[2];
    return resolveProviderBack(pathname, orgSlug, search)?.to || null;
  }
  if (
    pathname.startsWith('/customer') ||
    pathname.startsWith('/book/') ||
    pathname === '/services'
  ) {
    return resolveCustomerBack(pathname, search)?.to || null;
  }
  return resolvePublicBack(pathname, search)?.to || null;
}

/**
 * Same behavior as the header ← button: close overlays first, then in-app stack,
 * then the semantic parent route. Does not use browser history(-1).
 */
export function performAppBack({ pathname, search, navigate, preferFallback = false }) {
  if (closeTopOverlay()) return true;

  const entry = locationEntry({ pathname, search });
  if (!preferFallback) {
    const prev = consumePreviousInAppPath(entry);
    if (prev) {
      navigate(prev, { replace: true });
      return true;
    }
  }

  const fallback = resolveAppBackFallback(pathname, search);
  if (fallback) {
    navigate(fallback, { replace: true });
    return true;
  }

  return false;
}
