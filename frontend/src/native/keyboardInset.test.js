import {
  keyboardOverlapPx,
  KEYBOARD_OPEN_PX,
  fallbackKeyboardPx,
  resolveKeyboardInset,
} from './keyboardInset';

const idle = {
  sawMeasuredOpen: false,
  layoutShrunk: false,
  imeDismissed: false,
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

describe('resolveKeyboardInset', () => {
  test('uses the measured overlap when the keyboard actually resizes the viewport', () => {
    expect(
      resolveKeyboardInset({
        overlap: 320,
        vkHeight: 0,
        visualOffsetTop: 0,
        fieldFocused: true,
        innerHeight: 800,
        restInnerHeight: 800,
        heightAtFocus: 800,
        ...idle,
      }).inset
    ).toBe(320);
  });

  test('falls back when Android overlays the IME and reports no overlap', () => {
    const inset = resolveKeyboardInset({
      overlap: 0,
      vkHeight: 0,
      visualOffsetTop: 0,
      fieldFocused: true,
      innerHeight: 800,
      restInnerHeight: 800,
      heightAtFocus: 800,
      ...idle,
    }).inset;
    expect(inset).toBe(fallbackKeyboardPx(800));
    expect(inset).toBeGreaterThan(KEYBOARD_OPEN_PX);
  });

  test('does not pad when nothing is focused', () => {
    expect(
      resolveKeyboardInset({
        overlap: 0,
        vkHeight: 0,
        visualOffsetTop: 0,
        fieldFocused: false,
        innerHeight: 800,
        restInnerHeight: 800,
        heightAtFocus: 800,
        ...idle,
      }).inset
    ).toBe(0);
  });

  test('does not double-pad when the layout viewport already shrank', () => {
    const next = resolveKeyboardInset({
      overlap: 0,
      vkHeight: 0,
      visualOffsetTop: 0,
      fieldFocused: true,
      innerHeight: 500,
      restInnerHeight: 800,
      heightAtFocus: 800,
      ...idle,
    });
    expect(next.inset).toBe(0);
    expect(next.layoutShrunk).toBe(true);
  });

  test('prefers the Virtual Keyboard API height over the fallback', () => {
    expect(
      resolveKeyboardInset({
        overlap: 0,
        vkHeight: 290,
        visualOffsetTop: 0,
        fieldFocused: true,
        innerHeight: 800,
        restInnerHeight: 800,
        heightAtFocus: 800,
        ...idle,
      }).inset
    ).toBe(290);
  });

  test('drops the gap when the IME was measured and then hidden while focused', () => {
    const next = resolveKeyboardInset({
      overlap: 0,
      vkHeight: 0,
      visualOffsetTop: 0,
      fieldFocused: true,
      innerHeight: 800,
      restInnerHeight: 800,
      heightAtFocus: 800,
      sawMeasuredOpen: true,
      layoutShrunk: false,
      imeDismissed: false,
    });
    expect(next.inset).toBe(0);
    expect(next.imeDismissed).toBe(true);
  });

  test('drops the gap after Pixel down-arrow restores the nav-bar inset', () => {
    const next = resolveKeyboardInset({
      overlap: 0,
      vkHeight: 0,
      visualOffsetTop: 0,
      fieldFocused: true,
      innerHeight: 752,
      restInnerHeight: 800,
      heightAtFocus: 800,
      ...idle,
    });
    expect(next.inset).toBe(0);
    expect(next.imeDismissed).toBe(true);
  });

  test('does not bring the gap back after the layout recovers from a shrink', () => {
    const next = resolveKeyboardInset({
      overlap: 0,
      vkHeight: 0,
      visualOffsetTop: 0,
      fieldFocused: true,
      innerHeight: 800,
      restInnerHeight: 800,
      heightAtFocus: 800,
      sawMeasuredOpen: false,
      layoutShrunk: true,
      imeDismissed: false,
    });
    expect(next.inset).toBe(0);
    expect(next.imeDismissed).toBe(true);
  });

  test('keeps the gap gone after an explicit dismiss while the field stays focused', () => {
    expect(
      resolveKeyboardInset({
        overlap: 0,
        vkHeight: 0,
        visualOffsetTop: 0,
        fieldFocused: true,
        innerHeight: 800,
        restInnerHeight: 800,
        heightAtFocus: 800,
        sawMeasuredOpen: false,
        layoutShrunk: false,
        imeDismissed: true,
      }).inset
    ).toBe(0);
  });
});
