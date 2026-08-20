import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronLeft } from '../icons/NavIcons';

/**
 * Full-screen settings sheet so the Settings list can stay headings-only.
 */
export default function SettingsSectionOverlay({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sheet = (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-luminexa-canvas bg-lx-mesh"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-section-title"
    >
      <header className="lx-header">
        <div className="lx-container flex items-center gap-2 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm transition hover:border-teal-200 hover:text-luminexa-accent"
          >
            <IconChevronLeft />
          </button>
          <h2
            id="settings-section-title"
            className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-slate-900"
          >
            {title}
          </h2>
        </div>
      </header>
      <div className="lx-container min-h-0 flex-1 overflow-y-auto py-5 pb-28">{children}</div>
    </div>
  );

  return createPortal(sheet, document.body);
}
