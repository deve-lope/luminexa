import { useCallback, useEffect, useRef, useState } from 'react';

const DISMISS_KEY = 'luminexa_pwa_dismiss';
const DISMISS_DAYS = 14;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return /iP(hone|od|ad)/.test(navigator.userAgent) && !window.MSStream;
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
  const deferredPrompt = useRef(null);
  const [canInstall, setCanInstall] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (isStandalone()) return undefined;

    if (isIos() && !wasDismissedRecently()) {
      setShowIosGuide(true);
      return undefined;
    }

    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      if (!wasDismissedRecently()) setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
    }
    deferredPrompt.current = null;
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setCanInstall(false);
    setShowIosGuide(false);
  }, []);

  return { canInstall, showIosGuide, install, dismiss };
}
