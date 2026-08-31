import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { performAppBack } from '../utils/appBackNavigation';

/**
 * Android hardware / gesture back — same path as the header ← button,
 * not browser history (which often skips to home in the WebView).
 */
export default function AppBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  const navigateRef = useRef(navigate);

  locationRef.current = location;
  navigateRef.current = navigate;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let removed = false;
    let listener = null;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        if (removed) return;
        listener = await App.addListener('backButton', () => {
          const loc = locationRef.current;
          const handled = performAppBack({
            pathname: loc.pathname,
            search: loc.search,
            navigate: (...args) => navigateRef.current(...args),
          });
          if (!handled) {
            App.exitApp();
          }
        });
      } catch {
        /* plugin unavailable */
      }
    })();

    return () => {
      removed = true;
      listener?.remove?.();
    };
  }, []);

  return null;
}
