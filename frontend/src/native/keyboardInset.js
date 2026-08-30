/**
 * Keep focused fields above the on-screen keyboard on Android and iOS.
 *
 * Platforms report the keyboard three different ways, so we pick per device:
 *  - "platform": layout viewport shrinks (adjustResize / interactive-widget) —
 *    the browser already made room, so we add nothing.
 *  - "measured": visualViewport (iOS WKWebView, Android Chrome) or the Virtual
 *    Keyboard API reports the covered height — we use that exact height.
 *  - "fallback": Android edge-to-edge overlays the IME and reports nothing —
 *    only then do we estimate, and only after waiting for a real measurement.
 *
 * Guessing before that wait is what makes the field visibly jump, so
 * MEASURE_GRACE_MS must elapse with no signal before we estimate.
 */

export const KEYBOARD_OPEN_PX = 80;
/** Wait this long for a real keyboard measurement before estimating. */
export const MEASURE_GRACE_MS = 350;
/** Re-check points after a field is tapped, spanning the keyboard animation. */
export const FOCUS_SYNC_DELAYS_MS = [60, 180, MEASURE_GRACE_MS + 40, 650];
/** Keep a little air between the field and the sticky header / keyboard. */
export const FIELD_VIEW_GAP_PX = 8;

export function keyboardOverlapPx({ innerHeight, visualHeight, visualOffsetTop }) {
  const layoutH = Number(innerHeight) || 0;
  const visH = Number(visualHeight);
  const offsetTop = Number(visualOffsetTop) || 0;
  const visibleH = Number.isFinite(visH) ? visH : layoutH;
  return Math.max(0, Math.round(layoutH - visibleH - offsetTop));
}

/** Typical portrait IME; leaves room for the focused field above it. */
export function fallbackKeyboardPx(innerHeight) {
  const h = Number(innerHeight) || 0;
  if (h <= 0) return 0;
  const leaveVisible = Math.min(240, Math.round(h * 0.32));
  return Math.max(0, Math.round(Math.min(h * 0.46, h - leaveVisible)));
}

/**
 * Capawesome EdgeToEdge zeroes the WebView bottom margin while the IME is
 * visible and restores the nav-bar inset once it hides. Only report a dismiss
 * after we have seen the open state, so a device with no bottom inset (or a
 * reading taken before the IME animates in) cannot collapse the lift early.
 */
export function edgeToEdgeImeState({ bottom, sawImeOpen }) {
  const b = Number(bottom) || 0;
  if (b < 8) return { sawImeOpen: true, dismiss: false };
  if (sawImeOpen && b >= 16) return { sawImeOpen: true, dismiss: true };
  return { sawImeOpen: Boolean(sawImeOpen), dismiss: false };
}

/**
 * Only devices with an on-screen keyboard may use the estimate. A desktop
 * browser reports nothing when a field is focused because no keyboard exists,
 * which is indistinguishable from Android's silent overlay.
 */
export function canEstimateKeyboard({ coarsePointer, maxTouchPoints, nativeApp }) {
  if (nativeApp) return true;
  return Boolean(coarsePointer) && (Number(maxTouchPoints) || 0) > 0;
}

/** Modes that mean the keyboard was really up, so losing the signal = hidden. */
const OPEN_MODES = new Set(['measured', 'platform']);

/**
 * Pure transition so every platform path is testable.
 * `mode`: idle | waiting | measured | platform | fallback | dismissed
 */
export function nextKeyboardState(prev, snapshot) {
  const prevMode = prev?.mode || 'idle';
  const {
    fieldFocused,
    overlap,
    vkHeight,
    innerHeight,
    restInnerHeight,
    msSinceFocus,
    nativeDismissed,
    canEstimate = true,
  } = snapshot;

  if (!fieldFocused) return { mode: 'idle', inset: 0 };

  const measured = Math.max(Number(overlap) || 0, Number(vkHeight) || 0);
  if (measured > KEYBOARD_OPEN_PX) return { mode: 'measured', inset: measured };

  const current = Number(innerHeight) || 0;
  const rest = Number(restInnerHeight) || 0;
  if (rest - current > KEYBOARD_OPEN_PX) return { mode: 'platform', inset: 0 };

  // No live signal from here on.
  if (nativeDismissed || prevMode === 'dismissed' || OPEN_MODES.has(prevMode)) {
    return { mode: 'dismissed', inset: 0 };
  }
  if (!canEstimate) return { mode: 'waiting', inset: 0 };
  if (prevMode === 'fallback') return { mode: 'fallback', inset: fallbackKeyboardPx(current) };
  if ((Number(msSinceFocus) || 0) < MEASURE_GRACE_MS) return { mode: 'waiting', inset: 0 };
  return { mode: 'fallback', inset: fallbackKeyboardPx(current) };
}

/**
 * How far to scroll so a focused field sits fully between the sticky header
 * and the keyboard. Positive = field moves up. Zero if it is already in view.
 *
 * `scrollIntoView({ block: 'center' })` is what pulled the Find search box
 * up under the frozen "Book a service" banner.
 */
export function scrollDeltaToReveal({ fieldTop, fieldBottom, safeTop, safeBottom }) {
  const top = Number(fieldTop) || 0;
  const bottom = Number(fieldBottom) || 0;
  const minY = Number(safeTop) || 0;
  const maxY = Number(safeBottom) || 0;
  if (maxY - minY < 24) return 0;
  if (top >= minY && bottom <= maxY) return 0;
  if (bottom - top >= maxY - minY) return Math.round(top - minY);
  if (bottom > maxY) return Math.round(bottom - maxY);
  return Math.round(top - minY);
}

function isEditable(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = String(el.type || 'text').toLowerCase();
  return ![
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
  ].includes(type);
}

let appliedInset = -1;

function applyInset(px) {
  const inset = Math.max(0, Math.round(Number(px) || 0));
  if (inset === appliedInset) return;
  appliedInset = inset;
  const root = document.documentElement;
  root.style.setProperty('--lx-keyboard-inset', `${inset}px`);
  root.classList.toggle('lx-keyboard-open', inset > KEYBOARD_OPEN_PX);
}

function syncHeaderOffset() {
  const header = document.querySelector('.lx-header');
  const bottom = header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0;
  document.documentElement.style.setProperty('--lx-header-offset', `${bottom}px`);
  return bottom;
}

function visibleBottomPx(keyboardInset) {
  const vv = window.visualViewport;
  const vvBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const inset = Number(keyboardInset) || 0;
  return Math.min(vvBottom, window.innerHeight - (inset > KEYBOARD_OPEN_PX ? inset : 0));
}

function scrollParentOf(el) {
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function scrollFocusedIntoView() {
  const el = document.activeElement;
  if (!isEditable(el)) return;
  const rect = el.getBoundingClientRect();
  const headerBottom = syncHeaderOffset();
  const delta = scrollDeltaToReveal({
    fieldTop: rect.top,
    fieldBottom: rect.bottom,
    safeTop: headerBottom + FIELD_VIEW_GAP_PX,
    safeBottom: visibleBottomPx(appliedInset) - FIELD_VIEW_GAP_PX,
  });
  if (Math.abs(delta) < 2) return;
  const parent = scrollParentOf(el);
  if (parent === document.scrollingElement || parent === document.documentElement || parent === document.body) {
    window.scrollBy(0, delta);
  } else {
    parent.scrollTop += delta;
  }
}

function readVirtualKeyboardHeight() {
  try {
    const h = navigator.virtualKeyboard?.boundingRect?.height;
    return Number.isFinite(h) ? Math.round(h) : 0;
  } catch {
    return 0;
  }
}

function deviceCanEstimate() {
  let coarsePointer = false;
  try {
    coarsePointer = window.matchMedia?.('(pointer: coarse)').matches || false;
  } catch {
    coarsePointer = false;
  }
  return canEstimateKeyboard({
    coarsePointer,
    maxTouchPoints: navigator.maxTouchPoints,
    nativeApp: Boolean(window.Capacitor?.isNativePlatform?.()),
  });
}

export function measureKeyboardOverlap() {
  if (typeof window === 'undefined') return 0;
  const vv = window.visualViewport;
  return keyboardOverlapPx({
    innerHeight: window.innerHeight,
    visualHeight: vv ? vv.height : window.innerHeight,
    visualOffsetTop: vv ? vv.offsetTop : 0,
  });
}

let state = { mode: 'idle', inset: 0 };
let restInnerHeight = 0;
let focusAt = 0;
let nativeDismissed = false;
let e2eSawImeOpen = false;
let e2ePollId = 0;
let EdgeToEdgeApi = null;

function captureRestHeight() {
  if (isEditable(document.activeElement)) return;
  restInnerHeight = window.innerHeight;
}

function stopNativeImePoll() {
  if (e2ePollId) {
    window.clearInterval(e2ePollId);
    e2ePollId = 0;
  }
}

function markDismissed() {
  nativeDismissed = true;
  state = { mode: 'dismissed', inset: 0 };
  applyInset(0);
  stopNativeImePoll();
}

async function readNativeBottomInset() {
  try {
    if (!EdgeToEdgeApi) {
      const mod = await import('@capawesome/capacitor-android-edge-to-edge-support');
      EdgeToEdgeApi = mod.EdgeToEdge;
    }
    const result = await EdgeToEdgeApi.getInsets();
    return Number(result?.bottom) || 0;
  } catch {
    return null;
  }
}

/** Android only: watch the native IME inset so hide-keyboard collapses the lift. */
function startNativeImePoll() {
  stopNativeImePoll();
  e2eSawImeOpen = false;
  const tick = async () => {
    if (nativeDismissed || !isEditable(document.activeElement)) {
      stopNativeImePoll();
      return;
    }
    const bottom = await readNativeBottomInset();
    if (bottom == null) {
      stopNativeImePoll();
      return;
    }
    const next = edgeToEdgeImeState({ bottom, sawImeOpen: e2eSawImeOpen });
    e2eSawImeOpen = next.sawImeOpen;
    if (next.dismiss) markDismissed();
  };
  e2ePollId = window.setInterval(tick, 120);
  tick();
}

export function syncKeyboardInset({ scrollField = false } = {}) {
  if (typeof window === 'undefined') return 0;
  captureRestHeight();
  state = nextKeyboardState(state, {
    fieldFocused: isEditable(document.activeElement),
    overlap: measureKeyboardOverlap(),
    vkHeight: readVirtualKeyboardHeight(),
    innerHeight: window.innerHeight,
    restInnerHeight,
    msSinceFocus: Date.now() - focusAt,
    nativeDismissed,
    canEstimate: deviceCanEstimate(),
  });
  applyInset(state.inset);
  syncHeaderOffset();
  // Also scroll in "platform" mode, where the inset stays 0 but the shrunken
  // viewport can still leave the field off screen (iOS and resizing Android).
  if (scrollField && state.mode !== 'idle' && state.mode !== 'dismissed') {
    scrollFocusedIntoView();
  }
  return state.inset;
}

export function installKeyboardInset() {
  if (typeof window === 'undefined') return () => {};
  restInnerHeight = window.innerHeight;

  const timers = [];
  const later = (fn, ms) => {
    timers.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    while (timers.length) window.clearTimeout(timers.pop());
  };

  const onViewport = () => syncKeyboardInset({ scrollField: false });

  let detachHeaderObserver = () => {};
  const attachHeaderObserver = () => {
    let ro = null;
    const bind = () => {
      const el = document.querySelector('.lx-header');
      if (!el) return false;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => syncHeaderOffset());
        ro.observe(el);
      }
      syncHeaderOffset();
      return true;
    };
    if (bind()) {
      return () => ro?.disconnect();
    }
    const mo = new MutationObserver(() => {
      if (bind()) mo.disconnect();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  };
  detachHeaderObserver = attachHeaderObserver();

  const beginFocusSession = () => {
    focusAt = Date.now();
    nativeDismissed = false;
    state = { mode: 'waiting', inset: 0 };
    startNativeImePoll();
  };

  // Every session must be re-checked after the grace window expires, or one
  // that starts with no keyboard signal stays in "waiting" and never lifts.
  const syncAcrossKeyboardAnimation = () => {
    clearTimers();
    syncKeyboardInset({ scrollField: true });
    FOCUS_SYNC_DELAYS_MS.forEach((ms) =>
      later(() => syncKeyboardInset({ scrollField: true }), ms)
    );
  };

  const onFocusIn = () => {
    // Moving between fields while the keyboard is already up keeps the current
    // lift, so the layout does not collapse and re-expand between taps.
    if (state.mode === 'idle' || state.mode === 'dismissed') beginFocusSession();
    syncAcrossKeyboardAnimation();
  };

  const onFocusOut = () => {
    clearTimers();
    later(() => {
      if (!isEditable(document.activeElement)) {
        state = { mode: 'idle', inset: 0 };
        nativeDismissed = false;
        stopNativeImePoll();
      }
      syncKeyboardInset({ scrollField: false });
    }, 80);
  };

  const onPointerDown = (event) => {
    if (isEditable(event.target)) {
      // Re-tapping an already-focused field reopens the keyboard without firing
      // focusin, so this is the only chance to restart a dismissed session.
      if (state.mode === 'dismissed') {
        beginFocusSession();
        syncAcrossKeyboardAnimation();
      }
      return;
    }
    // Only the estimated lift can outlive the keyboard; tapping it collapses it.
    if (state.mode !== 'fallback' || state.inset <= KEYBOARD_OPEN_PX) return;
    if (event.clientY > window.innerHeight - state.inset) markDismissed();
  };

  const onKeyUp = (event) => {
    if (event.key === 'Escape' || event.key === 'GoBack' || event.keyCode === 4) {
      markDismissed();
    }
  };

  const vv = window.visualViewport;
  vv?.addEventListener('resize', onViewport);
  vv?.addEventListener('scroll', onViewport);
  window.addEventListener('resize', onViewport);
  window.addEventListener('orientationchange', onViewport);
  window.addEventListener('focusin', onFocusIn);
  window.addEventListener('focusout', onFocusOut);
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('keyup', onKeyUp, true);

  // Listen for keyboard geometry when available, but never set overlaysContent:
  // that would opt out of the browser's own resize, which needs no estimate.
  let vk = null;
  try {
    vk = navigator.virtualKeyboard || null;
    vk?.addEventListener('geometrychange', onViewport);
  } catch {
    vk = null;
  }

  syncKeyboardInset();

  return () => {
    clearTimers();
    vv?.removeEventListener('resize', onViewport);
    vv?.removeEventListener('scroll', onViewport);
    window.removeEventListener('resize', onViewport);
    window.removeEventListener('orientationchange', onViewport);
    window.removeEventListener('focusin', onFocusIn);
    window.removeEventListener('focusout', onFocusOut);
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    try {
      vk?.removeEventListener('geometrychange', onViewport);
    } catch {
      /* ignore */
    }
    stopNativeImePoll();
    detachHeaderObserver();
    state = { mode: 'idle', inset: 0 };
    applyInset(0);
  };
}
