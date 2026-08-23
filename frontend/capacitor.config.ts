import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor loads the live SPA so session cookies stay same-origin.
 * Login is isolated in the app WebView (not Chrome / Safari).
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
  ios: {
    // Safe areas are handled by the SPA's own CSS env(safe-area-inset-*) hooks.
    contentInset: 'never',
    backgroundColor: '#10231F',
    // Universal Links: opens https://app.luminex-a.com/b/... in the app when installed.
  },
  plugins: {
    // EdgeToEdge plugin owns WebView insets on Android 15+.
    SystemBars: {
      insetsHandling: 'disable',
      style: 'DARK',
    },
    EdgeToEdge: {
      backgroundColor: '#0D9488',
      statusBarColor: '#0D9488',
      navigationBarColor: '#10231F',
    },
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
