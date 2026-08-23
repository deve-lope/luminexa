import React, { useEffect } from 'react';

/** Full-screen photo overlay. Used by service carousels and storefront logos. */
export default function PictureLightbox({ slides, index, alt, onClose, onPrev, onNext }) {
  const current = slides[index];
  const hasMultiple = slides.length > 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasMultiple) onPrev();
      if (e.key === 'ArrowRight' && hasMultiple) onNext();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onPrev, onNext, hasMultiple]);

  if (!current?.image_url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Full size picture"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20"
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
    </div>
  );
}
