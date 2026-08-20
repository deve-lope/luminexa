import { Capacitor } from '@capacitor/core';

/** True when running inside the Capacitor Android/iOS shell. */
export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

/**
 * Status bar, splash, and Android notification permission.
 * Push delivery (FCM) still needs google-services.json + backend send.
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
    const status = await PushNotifications.requestPermissions();
    if (status.receive === 'granted') {
      await PushNotifications.register();
    }
  } catch {
    /* FCM not configured yet — permission prompt still attempted */
  }
}
