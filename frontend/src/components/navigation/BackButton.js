import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { consumePreviousInAppPath, locationEntry } from '../../utils/inAppNavStack';

export default function BackButton({
  fallback = '/',
  children = '← Back',
  className = 'lx-link',
  ariaLabel = 'Go back',
  /** When true, always go to fallback (avoids history loops e.g. setup redirects). */
  preferFallback = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    if (!preferFallback) {
      const prev = consumePreviousInAppPath(locationEntry(location));
      if (prev) {
        navigate(prev, { replace: true });
        return;
      }
    }
    if (fallback) {
      navigate(fallback, { replace: true });
    }
  };

  return (
    <button type="button" onClick={goBack} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
