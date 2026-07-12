import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scroll window to top on pathname changes (SPA navigation).
 * Ignores hash-only changes so in-page anchors still work.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Prefer instant jump so the new page header is visible immediately.
    const scroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      // Some mobile browsers keep focus/scroll on documentElement or body.
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scroll();
    // After layout paint (images/fonts/async content).
    const id = window.requestAnimationFrame(scroll);
    return () => window.cancelAnimationFrame(id);
  }, [pathname, search]);

  return null;
}
