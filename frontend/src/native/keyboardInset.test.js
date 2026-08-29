import {
  keyboardOverlapPx,
  KEYBOARD_OPEN_PX,
  MEASURE_GRACE_MS,
  FOCUS_SYNC_DELAYS_MS,
  fallbackKeyboardPx,
  nextKeyboardState,
  canEstimateKeyboard,
  edgeToEdgeImeState,
  scrollDeltaToReveal,
} from './keyboardInset';

/** Field focused, keyboard not reported yet, still inside the grace window. */
const justFocused = {
  fieldFocused: true,
  overlap: 0,
  vkHeight: 0,
  innerHeight: 800,
  restInnerHeight: 800,
  msSinceFocus: 0,
  nativeDismissed: false,
  canEstimate: true,
};

describe('keyboardOverlapPx', () => {
  test('no overlap when visual viewport matches the layout viewport', () => {
    expect(
      keyboardOverlapPx({ innerHeight: 800, visualHeight: 800, visualOffsetTop: 0 })
    ).toBe(0);
  });

  test('keyboard height is layout minus visible visual viewport', () => {
    expect(
      keyboardOverlapPx({ innerHeight: 800, visualHeight: 480, visualOffsetTop: 0 })
    ).toBe(320);
  });

  test('subtracts iOS visualViewport.offsetTop when the page is panned', () => {
    expect(
      keyboardOverlapPx({ innerHeight: 800, visualHeight: 480, visualOffsetTop: 40 })
    ).toBe(280);
  });

  test('never returns a negative inset', () => {
    expect(
      keyboardOverlapPx({ innerHeight: 700, visualHeight: 800, visualOffsetTop: 0 })
    ).toBe(0);
  });

  test('treats a missing visual height as no overlap', () => {
    expect(
      keyboardOverlapPx({ innerHeight: 800, visualHeight: undefined, visualOffsetTop: 0 })
    ).toBe(0);
  });

  test('keyboard-open threshold is above browser chrome jitter', () => {
    expect(KEYBOARD_OPEN_PX).toBeGreaterThan(40);
    const chrome = keyboardOverlapPx({
      innerHeight: 800,
      visualHeight: 780,
      visualOffsetTop: 0,
    });
    expect(chrome).toBeLessThan(KEYBOARD_OPEN_PX);
  });
});

describe('nextKeyboardState', () => {
  test('adds nothing while waiting for a first measurement (no focus flicker)', () => {
    expect(nextKeyboardState({ mode: 'idle' }, justFocused)).toEqual({
      mode: 'waiting',
      inset: 0,
    });
  });

  test('uses the measured height once visualViewport reports the keyboard', () => {
    expect(
      nextKeyboardState({ mode: 'waiting' }, { ...justFocused, overlap: 320 })
    ).toEqual({ mode: 'measured', inset: 320 });
  });

  test('uses the Virtual Keyboard API height when visualViewport says nothing', () => {
    expect(
      nextKeyboardState({ mode: 'waiting' }, { ...justFocused, vkHeight: 290 })
    ).toEqual({ mode: 'measured', inset: 290 });
  });

  test('adds nothing when the platform already shrank the layout viewport', () => {
    expect(
      nextKeyboardState({ mode: 'waiting' }, { ...justFocused, innerHeight: 500 })
    ).toEqual({ mode: 'platform', inset: 0 });
  });

  test('estimates only after the grace window passes with no signal', () => {
    const next = nextKeyboardState(
      { mode: 'waiting' },
      { ...justFocused, msSinceFocus: MEASURE_GRACE_MS + 10 }
    );
    expect(next.mode).toBe('fallback');
    expect(next.inset).toBe(fallbackKeyboardPx(800));
    expect(next.inset).toBeGreaterThan(KEYBOARD_OPEN_PX);
  });

  test('never estimates on a device with no on-screen keyboard', () => {
    expect(
      nextKeyboardState(
        { mode: 'waiting' },
        { ...justFocused, canEstimate: false, msSinceFocus: MEASURE_GRACE_MS + 500 }
      )
    ).toEqual({ mode: 'waiting', inset: 0 });
  });

  test('holds the estimate steady on later ticks', () => {
    const held = nextKeyboardState({ mode: 'fallback' }, justFocused);
    expect(held).toEqual({ mode: 'fallback', inset: fallbackKeyboardPx(800) });
  });

  test('collapses when a measured keyboard goes away while the field stays focused', () => {
    expect(nextKeyboardState({ mode: 'measured' }, justFocused)).toEqual({
      mode: 'dismissed',
      inset: 0,
    });
  });

  test('collapses when a platform-resized viewport is restored', () => {
    expect(nextKeyboardState({ mode: 'platform' }, justFocused)).toEqual({
      mode: 'dismissed',
      inset: 0,
    });
  });

  test('collapses the estimate when the native IME inset reports hidden', () => {
    expect(
      nextKeyboardState({ mode: 'fallback' }, { ...justFocused, nativeDismissed: true })
    ).toEqual({ mode: 'dismissed', inset: 0 });
  });

  test('stays collapsed instead of re-estimating after a dismiss', () => {
    expect(
      nextKeyboardState(
        { mode: 'dismissed' },
        { ...justFocused, msSinceFocus: MEASURE_GRACE_MS + 500 }
      )
    ).toEqual({ mode: 'dismissed', inset: 0 });
  });

  test('reopening is allowed once the keyboard is measured again', () => {
    expect(
      nextKeyboardState({ mode: 'dismissed' }, { ...justFocused, overlap: 320 })
    ).toEqual({ mode: 'measured', inset: 320 });
  });

  test('goes idle with no inset when nothing is focused', () => {
    expect(
      nextKeyboardState({ mode: 'measured' }, { ...justFocused, fieldFocused: false })
    ).toEqual({ mode: 'idle', inset: 0 });
  });
});

describe('FOCUS_SYNC_DELAYS_MS', () => {
  // Re-tapping a field only re-checked at 40ms once, inside the grace window,
  // so the keyboard reopened over a field that never lifted.
  test('re-checks after the grace window expires', () => {
    expect(FOCUS_SYNC_DELAYS_MS.some((ms) => ms > MEASURE_GRACE_MS)).toBe(true);
  });

  test('also re-checks during the keyboard animation', () => {
    expect(FOCUS_SYNC_DELAYS_MS.some((ms) => ms < MEASURE_GRACE_MS)).toBe(true);
  });
});

describe('canEstimateKeyboard', () => {
  test('a phone browser may estimate', () => {
    expect(
      canEstimateKeyboard({ coarsePointer: true, maxTouchPoints: 5, nativeApp: false })
    ).toBe(true);
  });

  test('the native app may always estimate', () => {
    expect(
      canEstimateKeyboard({ coarsePointer: false, maxTouchPoints: 0, nativeApp: true })
    ).toBe(true);
  });

  test('a desktop browser may not estimate', () => {
    expect(
      canEstimateKeyboard({ coarsePointer: false, maxTouchPoints: 0, nativeApp: false })
    ).toBe(false);
  });

  test('a touchscreen laptop driven by a mouse may not estimate', () => {
    expect(
      canEstimateKeyboard({ coarsePointer: false, maxTouchPoints: 10, nativeApp: false })
    ).toBe(false);
  });
});

describe('edgeToEdgeImeState', () => {
  test('treats a zeroed WebView bottom margin as the IME being open', () => {
    expect(edgeToEdgeImeState({ bottom: 0, sawImeOpen: false })).toEqual({
      sawImeOpen: true,
      dismiss: false,
    });
  });

  test('reports a dismiss when the nav-bar inset returns after the IME', () => {
    expect(edgeToEdgeImeState({ bottom: 48, sawImeOpen: true })).toEqual({
      sawImeOpen: true,
      dismiss: true,
    });
  });

  test('never dismisses before the IME has been seen open', () => {
    expect(edgeToEdgeImeState({ bottom: 48, sawImeOpen: false })).toEqual({
      sawImeOpen: false,
      dismiss: false,
    });
  });
});

describe('scrollDeltaToReveal', () => {
  const gap = { safeTop: 88, safeBottom: 480 };

  test('does not scroll when the field is already between the banner and the keyboard', () => {
    expect(
      scrollDeltaToReveal({ fieldTop: 120, fieldBottom: 168, ...gap })
    ).toBe(0);
  });

  test('scrolls the field up when the keyboard covers its bottom', () => {
    expect(
      scrollDeltaToReveal({ fieldTop: 420, fieldBottom: 520, ...gap })
    ).toBe(40);
  });

  test('scrolls the field down when the frozen banner covers its top', () => {
    expect(
      scrollDeltaToReveal({ fieldTop: 40, fieldBottom: 88, ...gap })
    ).toBe(-48);
  });

  test('pins a tall field just below the banner instead of centering it', () => {
    expect(
      scrollDeltaToReveal({ fieldTop: 20, fieldBottom: 900, ...gap })
    ).toBe(-68);
  });
});
