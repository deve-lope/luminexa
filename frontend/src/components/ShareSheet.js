import React from 'react';
import { createPortal } from 'react-dom';
import { useModalBodyLock } from '../hooks/useModalBodyLock';
import {
  canNativeShare,
  copyText,
  isIOSUserAgent,
  SHARE_TARGETS,
  shareHref,
  tryNativeShare,
} from '../utils/shareLink';

function Icon({ id }) {
  const common = 'h-6 w-6';
  if (id === 'whatsapp') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.79 14.16c-.24.68-1.4 1.25-1.94 1.33-.49.07-1.1.1-1.78-.11-.41-.13-.94-.31-1.63-.6-2.86-1.24-4.72-4.12-4.86-4.31-.14-.19-1.15-1.53-1.15-2.92 0-1.39.73-2.07.98-2.35.24-.27.53-.34.71-.34h.51c.16 0 .38-.06.59.45.24.58.8 2.02.87 2.17.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.29-.12.56.16.27.73 1.2 1.56 1.94 1.08.96 1.98 1.26 2.26 1.4.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.19-.27.37-.22.62-.13.26.1 1.63.77 1.91.91.27.14.45.22.52.34.07.12.07.7-.17 1.38z" />
      </svg>
    );
  }
  if (id === 'messages') {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12c0 4.4-4.03 8-9 8l-4 2v-3.1C5.2 17.4 3 14.9 3 12c0-4.4 4.03-8 9-8s9 3.6 9 8z" />
      </svg>
    );
  }
  if (id === 'email') {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8 6 8-6" />
      </svg>
    );
  }
  if (id === 'facebook') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M13.5 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.3 1.4-1.3H16.5V5.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.2H8v2.8h2.4V21h3.1z" />
      </svg>
    );
  }
  return (
    <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.4-4 8-9 8s-9-3.6-9-8 4-8 9-8 9 3.6 9 8z" />
    </svg>
  );
}

const TINT = {
  whatsapp: 'bg-emerald-50 text-emerald-700',
  messages: 'bg-sky-50 text-sky-800',
  email: 'bg-amber-50 text-amber-800',
  facebook: 'bg-indigo-50 text-indigo-800',
  telegram: 'bg-cyan-50 text-cyan-800',
};

export default function ShareSheet({
  open,
  url,
  title,
  text,
  onClose,
  onCopied,
}) {
  useModalBodyLock(open && Boolean(url));

  if (!open || !url) return null;

  const iOS = isIOSUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const payload = { title, text, url };

  const openTarget = (id) => {
    const href = shareHref(id, payload, { iOS });
    if (!href) return;
    window.open(href, id === 'email' || id === 'messages' ? '_self' : '_blank', 'noopener,noreferrer');
    onClose?.();
  };

  const onMore = async () => {
    const result = await tryNativeShare(payload);
    if (result === 'shared' || result === 'cancelled') onClose?.();
  };

  const onCopy = async () => {
    await copyText(url);
    onCopied?.();
    onClose?.();
  };

  const sheet = (
    <div
      className="lx-modal-overlay fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-sheet-title"
      onClick={() => onClose?.()}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-lx-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="share-sheet-title" className="text-lg font-semibold text-slate-900">
          Share
        </h2>
        <p className="mt-1 truncate text-sm text-slate-500">{url}</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {SHARE_TARGETS.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => openTarget(target.id)}
              className="flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition hover:bg-slate-50"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  TINT[target.id] || 'bg-slate-100 text-slate-700'
                }`}
              >
                <Icon id={target.id} />
              </span>
              <span className="text-xs font-semibold text-slate-700">{target.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {canNativeShare() && (
            <button type="button" onClick={onMore} className="lx-btn-secondary w-full">
              More apps
            </button>
          )}
          <button type="button" onClick={onCopy} className="lx-btn-ghost w-full">
            Copy link
          </button>
          <button type="button" onClick={() => onClose?.()} className="min-h-[44px] text-sm font-medium text-slate-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
