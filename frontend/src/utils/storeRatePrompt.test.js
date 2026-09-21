import {
  STORAGE_KEY,
  WEEK_MS,
  ensureFirstOpenedAt,
  markStoreRateCompleted,
  markStoreRateDismissed,
  shouldShowStoreRatePrompt,
} from './storeRatePrompt';

describe('store rate prompt', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('records firstOpenedAt once', () => {
    const t0 = 1_700_000_000_000;
    expect(ensureFirstOpenedAt(t0)).toBe(t0);
    expect(ensureFirstOpenedAt(t0 + 999)).toBe(t0);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).firstOpenedAt).toBe(t0);
  });

  test('skips web / missing store url', () => {
    ensureFirstOpenedAt(0);
    expect(shouldShowStoreRatePrompt({ isNative: false, storeUrl: 'https://play.google.com' })).toBe(
      false,
    );
    expect(shouldShowStoreRatePrompt({ isNative: true, storeUrl: null, now: WEEK_MS + 1 })).toBe(
      false,
    );
  });

  test('waits a week after first open', () => {
    const start = 1_700_000_000_000;
    ensureFirstOpenedAt(start);
    const url = 'https://play.google.com/store/apps/details?id=com.luminexa.app';
    expect(
      shouldShowStoreRatePrompt({ isNative: true, storeUrl: url, now: start + WEEK_MS - 1 }),
    ).toBe(false);
    expect(
      shouldShowStoreRatePrompt({ isNative: true, storeUrl: url, now: start + WEEK_MS }),
    ).toBe(true);
  });

  test('stops after dismiss or rate', () => {
    const start = 1_700_000_000_000;
    ensureFirstOpenedAt(start);
    const url = 'https://play.google.com/store/apps/details?id=com.luminexa.app';
    const later = start + WEEK_MS + 1000;
    markStoreRateDismissed(later);
    expect(shouldShowStoreRatePrompt({ isNative: true, storeUrl: url, now: later })).toBe(false);

    window.localStorage.clear();
    ensureFirstOpenedAt(start);
    markStoreRateCompleted(later);
    expect(shouldShowStoreRatePrompt({ isNative: true, storeUrl: url, now: later })).toBe(false);
  });
});
