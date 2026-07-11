import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function BackButton({
  fallback = '/',
  children = '← Back',
  className = 'lx-link',
  ariaLabel = 'Go back',
}) {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  };

  return (
    <button type="button" onClick={goBack} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
