import { useCallback, useEffect, useState } from 'react';
import { getPreferredStoreUrl } from '../utils/storeLinks';

const DISMISS_KEY = 'luminexa_pwa_dismiss';
const DISMISS_DAYS = 14;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isLocalDevHost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function wasDismissedRecently() {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

export default function usePwaInstall() {
  const [storeUrl, setStoreUrl] = useState(null);

  useEffect(() => {
    // Never let Chrome/Edge install a second, often stale PWA from this origin.
    const blockBrowserInstall = (e) => {
      e.preventDefault();
    };
    window.addEventListener('beforeinstallprompt', blockBrowserInstall);

    if (isStandalone() || isLocalDevHost() || wasDismissedRecently()) {
      return () => window.removeEventListener('beforeinstallprompt', blockBrowserInstall);
    }

    const url = getPreferredStoreUrl(navigator.userAgent || '');
    if (url) setStoreUrl(url);

    return () => window.removeEventListener('beforeinstallprompt', blockBrowserInstall);
  }, []);

  const install = useCallback(() => {
    if (!storeUrl) return;
    window.location.assign(storeUrl);
  }, [storeUrl]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setStoreUrl(null);
  }, []);

  return { canInstall: Boolean(storeUrl), showIosGuide: false, storeUrl, install, dismiss };
}
