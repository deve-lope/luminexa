import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { useOverlayHistoryBack } from '../../hooks/useOverlayHistoryBack';

/**
 * Full-screen modal shell above bottom tabs (z-110), safe areas, and keyboard inset.
 * Portals to document.body so parent stacking contexts cannot trap it under the tab bar.
 */
export default function ModalOverlay({
  children,
  onClose,
  labelledBy,
  className = '',
  sheetClassName = '',
  align = 'bottom', // 'bottom' | 'center'
  asSheet = true,
}) {
  useModalBodyLock();
  useOverlayHistoryBack(Boolean(onClose), onClose);

  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const alignClass =
    align === 'center' ? 'items-center' : 'items-end sm:items-center';

  const content = asSheet ? (
    <div className={`lx-modal-sheet ${sheetClassName}`.trim()}>{children}</div>
  ) : (
    children
  );

  return createPortal(
    <div
      className={`lx-modal-overlay fixed inset-0 z-[110] flex ${alignClass} justify-center bg-black/40 ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      {content}
    </div>,
    document.body
  );
}
