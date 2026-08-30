import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';

/** Full-screen photo overlay. Used by service carousels and storefront logos. */
export default function PictureLightbox({ slides, index, alt, onClose, onPrev, onNext }) {
  const current = slides[index];
  const hasMultiple = slides.length > 1;

  useModalBodyLock(Boolean(current?.image_url));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasMultiple) onPrev();
      if (e.key === 'ArrowRight' && hasMultiple) onNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext, hasMultiple]);

  if (!current?.image_url) return null;

  return createPortal(
    <div
      className="lx-modal-overlay fixed inset-0 z-[110] flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Full size picture"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20"
        style={{ top: 'max(1rem, var(--lx-sat))' }}
        aria-label="Close"
      >
        ×
      </button>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 sm:left-4"
            aria-label="Previous picture"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 sm:right-4"
            aria-label="Next picture"
          >
            ›
          </button>
        </>
      )}

      <div
        className="flex max-h-full max-w-full flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current.image_url}
          alt={alt}
          className="max-h-[85vh] max-w-full rounded-lg object-contain"
        />
        {hasMultiple && (
          <p className="mt-3 text-sm text-white/80">
            {index + 1} of {slides.length}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
