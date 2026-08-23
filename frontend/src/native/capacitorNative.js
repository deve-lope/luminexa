import { Capacitor } from '@capacitor/core';
import { userAPI } from '../utils/api';

const PENDING_TOKEN_KEY = 'luminexa.pendingFcmToken';

/** True when running inside the Capacitor Android/iOS shell. */
export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

/** Mark the document as soon as Cap is available (safe-area CSS hooks). */
export function markNativeDocument() {
  try {
    if (Capacitor.isNativePlatform()) {
      document.documentElement.classList.add('capacitor-native');
    }
  } catch {
    /* ignore */
  }
}

/** Poll until Cap bridge injects (remote URL can load before Cap is ready). */
export function watchNativeDocument() {
  markNativeDocument();
  if (document.documentElement.classList.contains('capacitor-native')) return;
  let n = 0;
  const t = window.setInterval(() => {
    markNativeDocument();
    if (document.documentElement.classList.contains('capacitor-native') || ++n > 60) {
      window.clearInterval(t);
    }
  }, 50);
}

/**
 * If Android still has 0 inset after bridge load, force a Pixel-safe top inset.
 * Used until / alongside native EdgeToEdge WebView padding.
 */
export function ensureAndroidSafeAreaFallback() {
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    const root = document.documentElement;
    const top = getComputedStyle(root).getPropertyValue('--safe-area-inset-top').trim();
    if (!top || top === '0px') {
      root.style.setProperty('--safe-area-inset-top', '48px');
    }
    const bottom = getComputedStyle(root).getPropertyValue('--safe-area-inset-bottom').trim();
    if (!bottom || bottom === '0px') {
      root.style.setProperty('--safe-area-inset-bottom', '24px');
    }
  } catch {
    /* ignore */
  }
}

markNativeDocument();
watchNativeDocument();

function nativePlatform() {
  const p = Capacitor.getPlatform();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

export async function syncPushTokenWithServer(token) {
  if (!token) return;
  try {
    await userAPI.registerPushToken({ token, platform: nativePlatform() });
    window.sessionStorage.removeItem(PENDING_TOKEN_KEY);
  } catch {
    window.sessionStorage.setItem(PENDING_TOKEN_KEY, token);
  }
}

/** Call after login / session restore so a pending FCM token is saved. */
export async function flushPendingPushToken() {
  if (!Capacitor.isNativePlatform()) return;
  const pending = window.sessionStorage.getItem(PENDING_TOKEN_KEY);
  if (pending) await syncPushTokenWithServer(pending);
}

export async function clearPushTokenOnLogout() {
  if (!Capacitor.isNativePlatform()) return;
  const pending = window.sessionStorage.getItem(PENDING_TOKEN_KEY);
  try {
    if (pending) {
      await userAPI.deletePushToken(pending);
      window.sessionStorage.removeItem(PENDING_TOKEN_KEY);
    } else {
      await userAPI.deletePushToken();
    }
  } catch {
    /* ignore */
  }
}

function navigateToAppUrl(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname;
    if (host !== 'app.luminex-a.com' && host !== window.location.hostname) return;
    const next = `${url.pathname}${url.search}${url.hash}` || '/';
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== here) window.location.assign(next);
  } catch {
    /* ignore malformed launch URLs */
  }
}

/**
 * Native chrome: EdgeToEdge insets (Android 15+), splash, push register.
 */
export async function bootstrapNativeApp() {
  if (!Capacitor.isNativePlatform()) return;
  markNativeDocument();

  try {
    const { App } = await import('@capacitor/app');
    const launch = await App.getLaunchUrl();
    if (launch?.url) navigateToAppUrl(launch.url);
    await App.addListener('appUrlOpen', (event) => {
      if (event?.url) navigateToAppUrl(event.url);
    });
  } catch {
    /* plugin missing in older AAB */
  }

  try {
    const { EdgeToEdge } = await import(
      '@capawesome/capacitor-android-edge-to-edge-support'
    );
    await EdgeToEdge.enable();
    await EdgeToEdge.setBackgroundColor({ color: '#0D9488' });
    window.__LX_EDGE_TO_EDGE__ = true;
  } catch {
    window.__LX_EDGE_TO_EDGE__ = false;
    /* plugin missing in older AAB — CSS fallback still applies */
  }

  try {
    const { SystemBars, SystemBarsStyle } = await import('@capacitor/core');
    await SystemBars.setStyle({ style: SystemBarsStyle.Dark });
  } catch {
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: Style.Dark });
    } catch {
      /* ignore */
    }
  }

  // Only force CSS insets when native EdgeToEdge plugin is absent (older AAB).
  if (!window.__LX_EDGE_TO_EDGE__) {
    window.setTimeout(ensureAndroidSafeAreaFallback, 400);
    window.setTimeout(ensureAndroidSafeAreaFallback, 1200);
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* ignore */
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    await PushNotifications.addListener('registration', (event) => {
      if (event?.value) syncPushTokenWithServer(event.value);
    });
    await PushNotifications.addListener('registrationError', () => {
      /* google-services.json missing or FCM misconfigured */
    });
    await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
      const path = event?.notification?.data?.link_path;
      if (path && typeof path === 'string' && path.startsWith('/')) {
        window.location.assign(path);
      }
    });

    const status = await PushNotifications.requestPermissions();
    if (status.receive === 'granted') {
      await PushNotifications.register();
    }
  } catch {
    /* FCM not configured yet */
  }
}
