import {
  resolveCustomerBack,
  resolveProviderBack,
  resolvePublicBack,
} from './navigationBack';
import {
  consumePreviousInAppPath,
  locationEntry,
} from './inAppNavStack';
import { peekSavedScrollY } from '../components/ScrollToTop';

/** @type {Set<() => void>} */
const overlayClosers = new Set();

/** Register a full-screen overlay; back should close it before leaving the page. */
export function registerOverlayCloser(close) {
  if (typeof close !== 'function') return () => {};
  overlayClosers.add(close);
  return () => overlayClosers.delete(close);
}

export function registeredOverlayCloserCount() {
  return overlayClosers.size;
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
      // If we still remember scroll for that screen, return without #service-
      // so ScrollToTop can restore Y once (avoids top → hash jump).
      const prevKey = prev.split('#')[0];
      const target =
        peekSavedScrollY(prevKey) > 0
          ? prevKey
          : withServiceHashIfNeeded(prev, pathname, search);
      navigate(target, { replace: true });
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

/**
 * When leaving a service detail page for its parent catalog/storefront,
 * pin #service-{id} so Back lands on that row (not the top of the list).
 */
export function withServiceHashIfNeeded(prevPath, currentPathname, currentSearch = '') {
  if (!prevPath || prevPath.includes('#')) return prevPath;
  const path = (currentPathname || '').replace(/\/$/, '') || '/';
  const detailMatch = path.match(/^(.*?)\/services\/([^/]+)$/);
  if (!detailMatch) return prevPath;

  const parentBase = detailMatch[1];
  const serviceId = detailMatch[2];
  const prevOnly = prevPath.split('?')[0].replace(/\/$/, '') || '/';
  const parentNorm = parentBase.replace(/\/$/, '') || '/';

  // Stack prev is the storefront/catalog for this org (or same path with ?cat=).
  if (prevOnly !== parentNorm) return prevPath;

  const cat = (() => {
    try {
      return new URLSearchParams(
        (currentSearch || '').startsWith('?') ? currentSearch.slice(1) : currentSearch,
      ).get('cat');
    } catch {
      return null;
    }
  })();
  const hasCat = prevPath.includes('cat=');
  let target = prevPath;
  if (cat && !hasCat) {
    target += `${prevPath.includes('?') ? '&' : '?'}cat=${encodeURIComponent(cat)}`;
  }
  return `${target}#service-${serviceId}`;
}
