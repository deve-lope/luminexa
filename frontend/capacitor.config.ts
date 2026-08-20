import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor loads the live SPA so session cookies stay same-origin.
 * Login is isolated in the Android WebView (not Chrome).
 */
const config: CapacitorConfig = {
  appId: 'com.luminexa.app',
  appName: 'Luminexa',
  webDir: 'build',
  server: {
    url: 'https://app.luminex-a.com',
    androidScheme: 'https',
    allowNavigation: ['app.luminex-a.com', '*.luminex-a.com', '*.stripe.com'],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#10231F',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#10231F',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
