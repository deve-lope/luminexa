import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function BackButton({
  fallback = '/',
  children = '← Back',
  className = 'lx-link',
  ariaLabel = 'Go back',
  /** When true, always go to fallback (avoids history loops e.g. setup redirects). */
  preferFallback = false,
}) {
  const navigate = useNavigate();

  const goBack = () => {
    if (!preferFallback && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallback, { replace: true });
  };

  return (
    <button type="button" onClick={goBack} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
