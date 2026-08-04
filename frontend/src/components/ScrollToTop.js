import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Persists across navigations so Back can restore where you were. */
const scrollPositions = new Map();

function locationKey(location) {
  return `${location.pathname}${location.search || ''}`;
}

function readScrollY() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function writeScrollY(y) {
  const top = Math.max(0, Number(y) || 0);
  window.scrollTo({ top, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = top;
  document.body.scrollTop = top;
}

/**
 * Scroll to #service-123 (or any hash target) once it exists in the DOM.
 * This is reliable on Android after remount — pixel Y often cannot stick.
 */
export function scrollToHashTarget(hash, { attempts = 50, intervalMs = 50 } = {}) {
  if (!hash || hash === '#') return () => {};
  const id = hash.startsWith('#') ? hash.slice(1) : hash;
  let n = 0;
  let cancelled = false;
  let timeoutId;

  const tick = () => {
    if (cancelled) return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      return;
    }
    n += 1;
    if (n >= attempts) return;
    timeoutId = window.setTimeout(tick, intervalMs);
  };

  tick();
  return () => {
    cancelled = true;
    if (timeoutId) window.clearTimeout(timeoutId);
  };
}

/**
 * Scroll to top only on a fresh PUSH to a pathname (no restore hash).
 * Back to a service list uses #service-id and scrolls that row into view.
 * Search-only changes (?cat=) never jump.
 */
export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prevLocationRef = useRef(location);

  useEffect(() => {
    const key = locationKey(location);
    const onScroll = () => {
      scrollPositions.set(key, readScrollY());
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [location]);

  useLayoutEffect(() => {
    const prev = prevLocationRef.current;
    const prevKey = locationKey(prev);
    const nextKey = locationKey(location);
    const pathnameChanged = prev.pathname !== location.pathname;

    if (prevKey !== nextKey) {
      scrollPositions.set(prevKey, readScrollY());
    }
    prevLocationRef.current = location;

    // Same pathname — keep scroll (?cat=). If hash appeared, aim at it.
    if (!pathnameChanged) {
      if (location.hash.startsWith('#service-')) {
        return scrollToHashTarget(location.hash);
      }
      return undefined;
    }

    // Return to a specific service row after "Show details".
    if (location.hash.startsWith('#service-')) {
      return scrollToHashTarget(location.hash);
    }

    const saved = scrollPositions.get(nextKey);
    const isReturnNav =
      navigationType === 'POP' ||
      navigationType === 'REPLACE' ||
      (navigationType === 'PUSH' && typeof saved === 'number' && saved > 0);

    if (isReturnNav) {
      // Do not force top on back — leave page where it is / let hash handler work.
      return undefined;
    }

    writeScrollY(0);
    const id = window.requestAnimationFrame(() => writeScrollY(0));
    return () => window.cancelAnimationFrame(id);
  }, [location, navigationType]);

  return null;
}
