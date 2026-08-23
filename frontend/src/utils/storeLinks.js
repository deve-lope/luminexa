/** Play / App Store listings. Always send “install” here — never Chrome/Safari PWA. */
export const ANDROID_PACKAGE_ID = 'com.luminexa.app';

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`;

/** Set when the iOS listing is live (e.g. https://apps.apple.com/app/id…). */
export const APP_STORE_URL = '';

export const APP_STORE_SEARCH_URL = 'https://apps.apple.com/search?term=Luminexa';

export function getAppStoreUrl() {
  return APP_STORE_URL || APP_STORE_SEARCH_URL;
}

export function isIosUserAgent(ua = '') {
  return /iP(hone|od|ad)/.test(ua) && !/MSStream/.test(ua);
}

export function isAndroidUserAgent(ua = '') {
  return /Android/i.test(ua);
}

/** Latest store listing for this device. Null = do not prompt install. */
export function getPreferredStoreUrl(ua = '') {
  if (isIosUserAgent(ua)) return getAppStoreUrl();
  if (isAndroidUserAgent(ua)) return PLAY_STORE_URL;
  return null;
}

/** Both stores — used on guest booking links when the app is not installed. */
export function getStoreInstallOptions() {
  return [
    { id: 'play', label: 'Install from Google Play', url: PLAY_STORE_URL },
    { id: 'ios', label: 'Install from the App Store', url: getAppStoreUrl() },
  ];
}
