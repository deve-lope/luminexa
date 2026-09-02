import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { registerOverlayCloser } from '../utils/appBackNavigation';

/**
 * The menu drawer pushes a dummy history entry so system back closes it first.
 * If a Link already navigated away, popping that trap would undo the tap
 * (About Luminexa / Account appear to do nothing on the phone).
 */
export function overlayUnmountShouldPopHistory(anchorUrl, currentUrl) {
  return Boolean(anchorUrl) && currentUrl === anchorUrl;
}

function currentLocationUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/**
 * System back / edge-swipe closes the overlay first (history trap),
 * matching what users expect before leaving the page.
 */
export function useOverlayHistoryBack(active, onClose) {
  const navigate = useNavigate();
  const location = useLocation();
  const closedRef = useRef(false);
  const pushedRef = useRef(false);
  const anchorRef = useRef('');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active || !onCloseRef.current) return undefined;

    closedRef.current = false;
    pushedRef.current = true;
    anchorRef.current = `${location.pathname}${location.search}${location.hash}`;
    window.history.pushState({ lxOverlay: true }, '');

    const dismiss = () => {
      if (closedRef.current) return;
      closedRef.current = true;
      pushedRef.current = false;
      onCloseRef.current?.();
    };

    const unregister = registerOverlayCloser(dismiss);

    const onPopState = () => {
      // Edge-swipe / browser back pops our trap entry; React Router may also POP
      // to home — close the overlay and restore the page that opened it.
      dismiss();
      const anchor = anchorRef.current;
      if (anchor) {
        navigate(anchor, { replace: true });
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      unregister();
      if (pushedRef.current && !closedRef.current) {
        closedRef.current = true;
        if (overlayUnmountShouldPopHistory(anchorRef.current, currentLocationUrl())) {
          window.history.back();
        }
      }
      pushedRef.current = false;
    };
    // Only trap history when the overlay opens/closes — not when onClose identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- anchor captured at open time above
  }, [active, navigate]);
}
