import React from 'react';
import { createPortal } from 'react-dom';
import { useModalBodyLock } from '../hooks/useModalBodyLock';
import { useOverlayHistoryBack } from '../hooks/useOverlayHistoryBack';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}) {
  useModalBodyLock(open);
  useOverlayHistoryBack(open, onClose);

  if (!open) return null;

  const confirmClasses =
    tone === 'danger'
      ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-105 text-white'
      : tone === 'success'
        ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:brightness-105 text-white'
        : 'lx-btn-primary';

  const dialog = (
    <div
      className="lx-modal-overlay fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => !busy && onClose?.()}
    >
      <div
        className={`w-full max-w-sm rounded-3xl bg-white p-5 shadow-lx-elevated ${
          tone === 'success' ? 'ring-2 ring-emerald-100' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {tone === 'success' && (
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-600"
            aria-hidden
          >
            ✓
          </div>
        )}
        {title && (
          <h2
            className={`text-lg font-semibold tracking-tight ${
              tone === 'success' ? 'text-center text-emerald-900' : 'text-slate-900'
            }`}
          >
            {title}
          </h2>
        )}
        {message && (
          <p
            className={`mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-line ${
              tone === 'success' ? 'text-center' : ''
            }`}
          >
            {message}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-[48px] flex-1 rounded-xl font-semibold disabled:opacity-60 ${confirmClasses}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
          {cancelLabel ? (
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="lx-btn-ghost min-h-[48px] flex-1 disabled:opacity-60"
            >
              {cancelLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
