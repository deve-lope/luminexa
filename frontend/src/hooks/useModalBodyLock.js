import { useEffect } from 'react';

/** Hide bottom tabs and lock scroll while a full-screen overlay is open. */
export function useModalBodyLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    document.documentElement.classList.add('lx-modal-open');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.classList.remove('lx-modal-open');
      document.body.style.overflow = prevOverflow;
    };
  }, [active]);
}
