import {
  PLAY_STORE_URL,
  getAppStoreUrl,
  getPreferredStoreUrl,
  getStoreInstallOptions,
} from './storeLinks';

describe('getPreferredStoreUrl', () => {
  test('Android browsers get the current Play Store listing', () => {
    expect(
      getPreferredStoreUrl(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36'
      )
    ).toBe(PLAY_STORE_URL);
  });

  test('iOS browsers get the App Store listing (search until APP_STORE_URL is set)', () => {
    expect(
      getPreferredStoreUrl(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      )
    ).toBe(getAppStoreUrl());
  });

  test('desktop browsers are not prompted (Play URL still exists for Android)', () => {
    expect(
      getPreferredStoreUrl(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'
      )
    ).toBeNull();
    expect(PLAY_STORE_URL).toBe(
      'https://play.google.com/store/apps/details?id=com.luminexa.app'
    );
    expect(getStoreInstallOptions().map((o) => o.id)).toEqual(['play', 'ios']);
  });
});
