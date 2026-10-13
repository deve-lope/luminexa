import {
  ANDROID_PACKAGE_ID,
  APP_STORE_URL,
  PLAY_STORE_URL,
  getAndroidOpenInAppUrl,
  getAppStoreUrl,
  getOpenInAppUrl,
  getPreferredStoreUrl,
  getStoreInstallOptions,
  getStoreReviewUrl,
  probePlayAppInstalled,
} from './storeLinks';

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';

describe('getPreferredStoreUrl', () => {
  test('Android browsers get the current Play Store listing', () => {
    expect(getPreferredStoreUrl(ANDROID_UA)).toBe(PLAY_STORE_URL);
  });

  test('iOS browsers get the live App Store listing', () => {
    expect(getPreferredStoreUrl(IOS_UA)).toBe(APP_STORE_URL);
    expect(getAppStoreUrl()).toBe(APP_STORE_URL);
  });

  test('desktop browsers are not prompted (Play URL still exists for Android)', () => {
    expect(getPreferredStoreUrl(DESKTOP_UA)).toBeNull();
    expect(PLAY_STORE_URL).toBe(
      'https://play.google.com/store/apps/details?id=com.luminexa.app'
    );
  });
});

describe('getStoreReviewUrl', () => {
  test('Android opens the Play listing', () => {
    expect(getStoreReviewUrl('android')).toBe(PLAY_STORE_URL);
  });

  test('iOS opens the App Store listing with write-review', () => {
    expect(getStoreReviewUrl('ios')).toContain(APP_STORE_URL);
    expect(getStoreReviewUrl('ios')).toContain('action=write-review');
  });

  test('web / unknown platform is skipped', () => {
    expect(getStoreReviewUrl('web')).toBeNull();
  });
});

describe('getStoreInstallOptions', () => {
  test('Android only offers Play', () => {
    expect(getStoreInstallOptions(ANDROID_UA).map((o) => o.id)).toEqual(['play']);
  });

  test('iOS only offers the App Store', () => {
    expect(getStoreInstallOptions(IOS_UA).map((o) => o.id)).toEqual(['ios']);
  });

  test('desktop offers both stores', () => {
    expect(getStoreInstallOptions(DESKTOP_UA).map((o) => o.id)).toEqual(['play', 'ios']);
  });
});

describe('getAndroidOpenInAppUrl', () => {
  test('builds an Intent URL for the Capacitor package', () => {
    const url = getAndroidOpenInAppUrl('https://app.luminex-a.com/b/abc123');
    expect(url).toContain('intent://app.luminex-a.com/b/abc123#Intent;');
    expect(url).toContain(`package=${ANDROID_PACKAGE_ID}`);
    expect(url).toContain('scheme=https');
    expect(url).toContain(`S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)}`);
    expect(url.endsWith(';end')).toBe(true);
  });

  test('rejects non-https URLs', () => {
    expect(getAndroidOpenInAppUrl('http://app.luminex-a.com/b/x')).toBe('');
  });
});

describe('getOpenInAppUrl', () => {
  const booking = 'https://app.luminex-a.com/b/tok';

  test('Android uses an Intent URL', () => {
    expect(getOpenInAppUrl(booking, ANDROID_UA)).toBe(getAndroidOpenInAppUrl(booking));
  });

  test('iOS returns the https Universal Link', () => {
    expect(getOpenInAppUrl(booking, IOS_UA)).toBe(booking);
  });

  test('desktop has no open-in-app handoff', () => {
    expect(getOpenInAppUrl(booking, DESKTOP_UA)).toBe('');
  });
});

describe('probePlayAppInstalled', () => {
  afterEach(() => {
    delete navigator.getInstalledRelatedApps;
  });

  test('returns null when the API is unavailable', async () => {
    expect(await probePlayAppInstalled()).toBeNull();
  });

  test('returns true when the Play package is listed', async () => {
    navigator.getInstalledRelatedApps = jest.fn().mockResolvedValue([
      { id: ANDROID_PACKAGE_ID, platform: 'play' },
    ]);
    expect(await probePlayAppInstalled()).toBe(true);
  });

  test('returns false when related apps are empty', async () => {
    navigator.getInstalledRelatedApps = jest.fn().mockResolvedValue([]);
    expect(await probePlayAppInstalled()).toBe(false);
  });
});
