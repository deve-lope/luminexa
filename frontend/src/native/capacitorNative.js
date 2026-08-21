import { Capacitor } from '@capacitor/core';
import { userAPI } from '../utils/api';

const PENDING_TOKEN_KEY = 'luminexa.pendingFcmToken';

/** True when running inside the Capacitor Android/iOS shell. */
export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

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

/**
 * Status bar, splash, notification permission, FCM register, and tap → deep link.
 */
export async function bootstrapNativeApp() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setBackgroundColor({ color: '#0D9488' });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* web or plugin missing */
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
    /* FCM not configured yet — permission prompt still attempted */
  }
}
