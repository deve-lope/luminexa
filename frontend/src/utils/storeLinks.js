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

/**
 * Store install buttons for guest booking links when the native app is not installed.
 * Mobile UAs get only their store; desktop gets both.
 */
export function getStoreInstallOptions(ua = '') {
  const agent = ua || (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
  if (isAndroidUserAgent(agent)) {
    return [{ id: 'play', label: 'Install from Google Play', url: PLAY_STORE_URL }];
  }
  if (isIosUserAgent(agent)) {
    return [{ id: 'ios', label: 'Install from the App Store', url: getAppStoreUrl() }];
  }
  return [
    { id: 'play', label: 'Install from Google Play', url: PLAY_STORE_URL },
    { id: 'ios', label: 'Install from the App Store', url: getAppStoreUrl() },
  ];
}

/**
 * Android Intent URL that opens the Capacitor app for an https App Link.
 * Falls back to Play Store when the package is not installed.
 */
export function getAndroidOpenInAppUrl(httpsUrl, { fallbackToPlay = true } = {}) {
  if (!httpsUrl) return '';
  let parsed;
  try {
    parsed = new URL(httpsUrl);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'https:') return '';
  const pathAndQuery = `${parsed.host}${parsed.pathname}${parsed.search}`;
  let intent = `intent://${pathAndQuery}#Intent;scheme=https;package=${ANDROID_PACKAGE_ID}`;
  if (fallbackToPlay) {
    intent += `;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)}`;
  }
  return `${intent};end`;
}

/**
 * URL that should hand off to the installed native app from mobile Chrome/Safari.
 * Android: Intent → package. iOS: same https Universal Link (best-effort).
 */
export function getOpenInAppUrl(httpsUrl, ua = '') {
  const agent = ua || (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
  if (isAndroidUserAgent(agent)) return getAndroidOpenInAppUrl(httpsUrl);
  if (isIosUserAgent(agent)) return httpsUrl || '';
  return '';
}

/**
 * Detect the Play app via Related Applications (Chrome Android + assetlinks).
 * @returns {Promise<boolean|null>} true / false when known, null when unsupported.
 */
export async function probePlayAppInstalled() {
  if (typeof navigator === 'undefined' || typeof navigator.getInstalledRelatedApps !== 'function') {
    return null;
  }
  try {
    const apps = await navigator.getInstalledRelatedApps();
    if (!Array.isArray(apps)) return null;
    const installed = apps.some((app) => {
      const id = String(app?.id || '');
      return id === ANDROID_PACKAGE_ID || id.includes(ANDROID_PACKAGE_ID);
    });
    return installed;
  } catch {
    return null;
  }
}
