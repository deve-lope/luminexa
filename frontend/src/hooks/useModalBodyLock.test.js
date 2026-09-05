import { lockModalBody, unlockModalBody } from './useModalBodyLock';

describe('modal body lock (iOS-safe)', () => {
  beforeEach(() => {
    document.body.style.cssText = '';
    document.documentElement.className = '';
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true });
    window.scrollTo = jest.fn((x, y) => {
      Object.defineProperty(window, 'scrollY', {
        configurable: true,
        value: typeof x === 'object' ? x.top : y,
        writable: true,
      });
    });
    // Drain any leftover locks from a failed assertion.
    for (let i = 0; i < 5; i += 1) unlockModalBody();
  });

  test('locks with position fixed and restores scroll on unlock', () => {
    document.documentElement.classList.remove('capacitor-ios');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120, writable: true });
    lockModalBody();
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-120px');
    expect(document.documentElement.classList.contains('lx-modal-open')).toBe(true);

    unlockModalBody();
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(document.documentElement.classList.contains('lx-modal-open')).toBe(false);
  });

  test('iOS uses overflow lock without position fixed', () => {
    document.documentElement.classList.add('capacitor-ios');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 80, writable: true });
    lockModalBody();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('');
    unlockModalBody();
    expect(document.body.style.overflow).toBe('');
    document.documentElement.classList.remove('capacitor-ios');
  });

  test('ref-counts stacked locks', () => {
    lockModalBody();
    lockModalBody();
    unlockModalBody();
    expect(document.body.style.position).toBe('fixed');
    unlockModalBody();
    expect(document.body.style.position).toBe('');
  });
});
