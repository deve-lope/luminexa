/**
 * Keep focused fields above the on-screen keyboard.
 *
 * Android Capacitor (edge-to-edge) often overlays the IME without shrinking
 * visualViewport. A focus-based fallback lifts the layout so the field stays
 * visible — but Pixel's keyboard-down control does not blur the field, so we
 * must drop that fallback as soon as the IME is gone.
 */

export const KEYBOARD_OPEN_PX = 80;
export const NAV_INSET_HIDE_PX = 20;

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

export function resolveKeyboardInset({
  overlap,
  vkHeight,
  visualOffsetTop,
  fieldFocused,
  innerHeight,
  restInnerHeight,
  heightAtFocus,
  sawMeasuredOpen,
  layoutShrunk,
  imeDismissed,
}) {
  const measured = Math.max(Number(overlap) || 0, Number(vkHeight) || 0);
  const offsetTop = Number(visualOffsetTop) || 0;
  const current = Number(innerHeight) || 0;
  const rest = Number(restInnerHeight) || 0;
  const atFocus = Number(heightAtFocus) || 0;

  if (!fieldFocused) {
    return {
      inset: 0,
      sawMeasuredOpen: false,
      layoutShrunk: false,
      imeDismissed: false,
    };
  }

  if (measured > KEYBOARD_OPEN_PX || offsetTop > KEYBOARD_OPEN_PX) {
    return {
      inset: measured > KEYBOARD_OPEN_PX ? measured : fallbackKeyboardPx(current),
      sawMeasuredOpen: true,
      layoutShrunk,
      imeDismissed: false,
    };
  }

  // Viewport reported an open IME, then went back to 0 — Pixel down-arrow.
  if (sawMeasuredOpen) {
    return {
      inset: 0,
      sawMeasuredOpen: true,
      layoutShrunk,
      imeDismissed: true,
    };
  }

  if (imeDismissed) {
    return { inset: 0, sawMeasuredOpen, layoutShrunk, imeDismissed: true };
  }

  // adjustResize / interactive-widget: layout shrank for the IME.
  if (rest - current > KEYBOARD_OPEN_PX) {
    return { inset: 0, sawMeasuredOpen, layoutShrunk: true, imeDismissed: false };
  }

  // Layout was shrunk and is now full again — IME hidden, caret still in the field.
  if (layoutShrunk) {
    return { inset: 0, sawMeasuredOpen, layoutShrunk: true, imeDismissed: true };
  }

  // Edge-to-edge Android: hiding the IME restores the nav-bar WebView margin,
  // so innerHeight drops a little while the field stays focused.
  if (atFocus > 0 && current < atFocus - NAV_INSET_HIDE_PX) {
    return { inset: 0, sawMeasuredOpen, layoutShrunk, imeDismissed: true };
  }

  return {
    inset: fallbackKeyboardPx(current),
    sawMeasuredOpen,
    layoutShrunk,
    imeDismissed: false,
  };
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

function applyInset(px) {
  const root = document.documentElement;
  const inset = Math.max(0, Math.round(Number(px) || 0));
  root.style.setProperty('--lx-keyboard-inset', `${inset}px`);
  root.classList.toggle('lx-keyboard-open', inset > KEYBOARD_OPEN_PX);
}

function scrollFocusedIntoView() {
  const el = document.activeElement;
  if (!isEditable(el) || typeof el.scrollIntoView !== 'function') return;
  try {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
  } catch {
    el.scrollIntoView(true);
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

export function measureKeyboardOverlap() {
  if (typeof window === 'undefined') return 0;
  const vv = window.visualViewport;
  return keyboardOverlapPx({
    innerHeight: window.innerHeight,
    visualHeight: vv ? vv.height : window.innerHeight,
    visualOffsetTop: vv ? vv.offsetTop : 0,
  });
}

let restInnerHeight = 0;
let heightAtFocus = 0;
let sawMeasuredOpen = false;
let layoutShrunk = false;
let imeDismissed = false;

function captureRestHeight() {
  if (typeof window === 'undefined') return;
  if (isEditable(document.activeElement)) return;
  restInnerHeight = window.innerHeight;
}

function resetFocusSession() {
  heightAtFocus = typeof window !== 'undefined' ? window.innerHeight : 0;
  sawMeasuredOpen = false;
  layoutShrunk = false;
  imeDismissed = false;
}

function dismissImeWhileFocused() {
  imeDismissed = true;
  applyInset(0);
}

export function syncKeyboardInset({ scrollField = false } = {}) {
  if (typeof window === 'undefined') return 0;
  captureRestHeight();
  const vv = window.visualViewport;
  const next = resolveKeyboardInset({
    overlap: measureKeyboardOverlap(),
    vkHeight: readVirtualKeyboardHeight(),
    visualOffsetTop: vv ? vv.offsetTop : 0,
    fieldFocused: isEditable(document.activeElement),
    innerHeight: window.innerHeight,
    restInnerHeight,
    heightAtFocus,
    sawMeasuredOpen,
    layoutShrunk,
    imeDismissed,
  });
  sawMeasuredOpen = next.sawMeasuredOpen;
  layoutShrunk = next.layoutShrunk;
  imeDismissed = next.imeDismissed;
  applyInset(next.inset);
  if (scrollField && next.inset > 0) scrollFocusedIntoView();
  return next.inset;
}

export function installKeyboardInset() {
  if (typeof window === 'undefined') return () => {};
  restInnerHeight = window.innerHeight;
  resetFocusSession();

  const timers = [];
  const later = (fn, ms) => {
    timers.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    while (timers.length) window.clearTimeout(timers.pop());
  };

  const onViewport = () => syncKeyboardInset({ scrollField: false });
  const onFocusIn = () => {
    clearTimers();
    resetFocusSession();
    syncKeyboardInset({ scrollField: true });
    later(() => syncKeyboardInset({ scrollField: true }), 50);
    later(() => syncKeyboardInset({ scrollField: true }), 200);
    later(() => syncKeyboardInset({ scrollField: true }), 450);
  };
  const onFocusOut = () => {
    clearTimers();
    later(() => {
      if (!isEditable(document.activeElement)) resetFocusSession();
      syncKeyboardInset({ scrollField: false });
    }, 80);
  };

  const onPointerDown = (event) => {
    const target = event.target;
    if (isEditable(target)) {
      if (imeDismissed) {
        resetFocusSession();
        later(() => syncKeyboardInset({ scrollField: true }), 40);
      }
      return;
    }
    const inset =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--lx-keyboard-inset')
      ) || 0;
    // Tap the leftover IME gap (keyboard already gone) to collapse it.
    if (inset > KEYBOARD_OPEN_PX && event.clientY > window.innerHeight - inset) {
      dismissImeWhileFocused();
    }
  };

  const onKeyUp = (event) => {
    const key = event.key;
    const code = event.keyCode;
    if (key === 'Escape' || key === 'GoBack' || code === 4 || code === 27) {
      dismissImeWhileFocused();
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

  let vk = null;
  try {
    vk = navigator.virtualKeyboard || null;
    if (vk) {
      vk.overlaysContent = true;
      vk.addEventListener('geometrychange', onViewport);
    }
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
    applyInset(0);
  };
}
