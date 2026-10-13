import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Persists across navigations so Back can restore where you were. */
const scrollPositions = new Map();

const RESTORE_CLASS = 'lx-scroll-restoring';

export function peekSavedScrollY(pathAndSearch) {
  const key = String(pathAndSearch || '').split('#')[0];
  const y = scrollPositions.get(key);
  return typeof y === 'number' ? y : 0;
}

/** Copy a remembered Y onto another path (e.g. /schedule → /schedule?day=…). */
export function aliasSavedScrollY(fromPathAndSearch, toPathAndSearch) {
  const fromKey = String(fromPathAndSearch || '').split('#')[0];
  const toKey = String(toPathAndSearch || '').split('#')[0];
  if (!fromKey || !toKey || fromKey === toKey) return;
  const y = scrollPositions.get(fromKey);
  if (typeof y !== 'number' || y <= 0) return;
  if (typeof scrollPositions.get(toKey) === 'number' && scrollPositions.get(toKey) > 0) return;
  scrollPositions.set(toKey, y);
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
 * Restore scroll once after Back. Keep it light — padding / intervals / opacity
 * fights caused visible glitching on desktop when schedule remounts.
 */
export function pinScrollPosition(saved) {
  if (typeof saved !== 'number' || saved <= 0) return () => {};

  const html = document.documentElement;
  html.classList.add(RESTORE_CLASS);
  writeScrollY(saved);

  let cancelled = false;
  let raf1 = 0;
  let raf2 = 0;
  let t1 = 0;
  let t2 = 0;

  const hold = () => {
    if (cancelled) return;
    writeScrollY(saved);
  };

  raf1 = window.requestAnimationFrame(() => {
    hold();
    raf2 = window.requestAnimationFrame(() => {
      hold();
      html.classList.remove(RESTORE_CLASS);
    });
  });
  // One late settle after the destination paints (no looping pad fight).
  t1 = window.setTimeout(hold, 50);
  t2 = window.setTimeout(hold, 150);

  return () => {
    cancelled = true;
    if (raf1) window.cancelAnimationFrame(raf1);
    if (raf2) window.cancelAnimationFrame(raf2);
    if (t1) window.clearTimeout(t1);
    if (t2) window.clearTimeout(t2);
    html.classList.remove(RESTORE_CLASS);
  };
}

/** @deprecated Prefer pinScrollPosition. */
export function restoreScrollY(saved) {
  return pinScrollPosition(saved);
}

/**
 * Scroll to top only on a fresh PUSH to a pathname.
 * Back restores remembered Y before paint (no visible top→down jump).
 */
export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prevLocationRef = useRef(location);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const key = locationKey(location);
    const onScroll = () => {
      // Ignore transient positions while we are pinning a restore.
      if (document.documentElement.classList.contains(RESTORE_CLASS)) return;
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
      if (
        !document.documentElement.classList.contains(RESTORE_CLASS) &&
        (y > 0 || typeof prior !== 'number')
      ) {
        scrollPositions.set(prevKey, y);
      }
    }
    prevLocationRef.current = location;

    // Same pathname — keep scroll (?day= / ?cat=). Hash added in-place → pin the row.
    // Do not re-pin on query-only changes (schedule day picks) — that glitches on desktop.
    if (!pathnameChanged) {
      if (location.hash.startsWith('#service-')) {
        return scrollToHashTarget(location.hash);
      }
      return undefined;
    }

    const saved = scrollPositions.get(nextKey);
    const wantsRestore = Boolean(location.state?.lxRestoreScroll);
    const isReturnNav =
      navigationType === 'POP' ||
      (navigationType === 'REPLACE' && wantsRestore) ||
      (navigationType === 'PUSH' && wantsRestore && typeof saved === 'number' && saved > 0);

    if (isReturnNav) {
      if (typeof saved === 'number' && saved > 0) {
        return pinScrollPosition(saved);
      }
      return undefined;
    }

    writeScrollY(0);
    const id = window.requestAnimationFrame(() => writeScrollY(0));
    return () => window.cancelAnimationFrame(id);
  }, [location, navigationType]);

  return null;
}
