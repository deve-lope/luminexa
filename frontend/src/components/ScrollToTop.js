import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Persists across navigations so Back can restore where you were. */
const scrollPositions = new Map();

export function peekSavedScrollY(pathAndSearch) {
  const key = String(pathAndSearch || '').split('#')[0];
  const y = scrollPositions.get(key);
  return typeof y === 'number' ? y : 0;
}

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
 * Prefer calling this after list data has rendered (e.g. storefront load).
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
 * Restore Y only once the document is tall enough — avoids the visible
 * jump from clamped top → mid-page after async content mounts.
 */
function restoreScrollY(saved) {
  if (typeof saved !== 'number' || saved <= 0) return () => {};

  let cancelled = false;
  let tries = 0;
  let timeoutId;
  let rafId;

  const attempt = () => {
    if (cancelled) return;
    const maxScroll = Math.max(
      0,
      (document.documentElement.scrollHeight || document.body.scrollHeight || 0) -
        window.innerHeight,
    );
    // Wait until layout can actually hold this offset (or give up after ~1s).
    if (maxScroll < saved - 40 && tries < 20) {
      tries += 1;
      timeoutId = window.setTimeout(attempt, 50);
      return;
    }
    writeScrollY(Math.min(saved, maxScroll));
  };

  rafId = window.requestAnimationFrame(attempt);
  return () => {
    cancelled = true;
    if (timeoutId) window.clearTimeout(timeoutId);
    if (rafId) window.cancelAnimationFrame(rafId);
  };
}

/**
 * Scroll to top only on a fresh PUSH to a pathname.
 * Back restores remembered Y. #service- row pinning is left to the page after
 * its data loads (avoids double scroll / flash with BookingStorefrontPage).
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
      const y = readScrollY();
      // After route change the window is often already at 0 — don't wipe a good saved Y.
      const prior = scrollPositions.get(prevKey);
      if (y > 0 || typeof prior !== 'number') {
        scrollPositions.set(prevKey, y);
      }
    }
    prevLocationRef.current = location;

    // Same pathname — keep scroll (?cat=). Hash added in-place → pin the row.
    if (!pathnameChanged) {
      if (location.hash.startsWith('#service-')) {
        return scrollToHashTarget(location.hash);
      }
      return undefined;
    }

    const saved = scrollPositions.get(nextKey);
    const isReturnNav =
      navigationType === 'POP' ||
      navigationType === 'REPLACE' ||
      (navigationType === 'PUSH' && typeof saved === 'number' && saved > 0);

    if (isReturnNav) {
      // Prefer saved Y when we have it (smoother than top→hash jump).
      if (typeof saved === 'number' && saved > 0) {
        return restoreScrollY(saved);
      }
      // #service- without saved Y: storefront scrolls after data loads.
      return undefined;
    }

    writeScrollY(0);
    const id = window.requestAnimationFrame(() => writeScrollY(0));
    return () => window.cancelAnimationFrame(id);
  }, [location, navigationType]);

  return null;
}
