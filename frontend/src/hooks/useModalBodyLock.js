import { useEffect } from 'react';

/**
 * iOS WKWebView (Capacitor) often sticks page scroll after `overflow: hidden`
 * alone. Lock with position:fixed + restore scrollY on unlock. Ref-count so
 * stacked modals do not unlock early.
 */
let lockCount = 0;
let lockedScrollY = 0;

export function lockModalBody() {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    lockedScrollY =
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const { body } = document;
    const isIos = document.documentElement.classList.contains('capacitor-ios');
    body.style.overflow = 'hidden';
    // position:fixed + top:-scrollY breaks iOS keyboard focus (page jumps /
    // "zooms" to the top when tapping the chat composer). Overflow lock is enough
    // under a full-screen sheet.
    if (!isIos) {
      body.style.position = 'fixed';
      body.style.top = `-${lockedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
    }
    document.documentElement.classList.add('lx-modal-open');
  }
  lockCount += 1;
}

export function unlockModalBody() {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;
  const { body } = document;
  const wasFixed = body.style.position === 'fixed';
  body.style.overflow = '';
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  document.documentElement.classList.remove('lx-modal-open');
  const y = lockedScrollY;
  lockedScrollY = 0;
  if (!wasFixed) return;
  // Double rAF: iOS needs a paint after clearing fixed before scrollTo sticks.
  window.requestAnimationFrame(() => {
    window.scrollTo(0, y);
    window.requestAnimationFrame(() => {
      window.scrollTo(0, y);
    });
  });
}

/** Hide bottom tabs and lock scroll while a full-screen overlay is open. */
export function useModalBodyLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    lockModalBody();
    return () => unlockModalBody();
  }, [active]);
}
