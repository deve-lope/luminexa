import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';

const SWIPE_DISTANCE_PX = 56;
const SWIPE_VELOCITY_PX_MS = 0.45;

function Chevron({ direction }) {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
      />
    </svg>
  );
}

/**
 * Full-screen photo overlay. Used by service carousels, galleries, storefront logos and chat.
 * Swipe left / right (touch or mouse drag) to change pictures; arrows and ←/→ keys also work.
 */
export default function PictureLightbox({ slides, index, alt, onClose, onPrev, onNext }) {
  const current = slides[index];
  const hasMultiple = slides.length > 1;

  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef({ id: null, startX: 0, startY: 0, startT: 0, axis: null, moved: false });
  const suppressClickUntil = useRef(0);
  const directionRef = useRef(0);

  useModalBodyLock(Boolean(current?.image_url));

  const goPrev = useCallback(() => {
    directionRef.current = -1;
    onPrev();
  }, [onPrev]);

  const goNext = useCallback(() => {
    directionRef.current = 1;
    onNext();
  }, [onNext]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasMultiple) goPrev();
      if (e.key === 'ArrowRight' && hasMultiple) goNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext, hasMultiple]);

  // Warm the neighbours so a swipe never lands on a blank frame.
  useEffect(() => {
    if (!hasMultiple) return;
    [slides[(index + 1) % slides.length], slides[(index - 1 + slides.length) % slides.length]]
      .filter((s) => s?.image_url)
      .forEach((s) => {
        const img = new Image();
        img.src = s.image_url;
      });
  }, [index, slides, hasMultiple]);

  const resetGesture = () => {
    gesture.current = { id: null, startX: 0, startY: 0, startT: 0, axis: null, moved: false };
    setDragging(false);
    setDragX(0);
  };

  const onPointerDown = (e) => {
    if (!hasMultiple) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesture.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startT: Date.now(),
      axis: null,
      moved: false,
    };
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (g.id !== e.pointerId) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (g.axis === 'x') {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* pointer already released */
        }
        setDragging(true);
      }
    }
    if (g.axis !== 'x') return;
    g.moved = true;
    setDragX(dx);
  };

  const onPointerUp = (e) => {
    const g = gesture.current;
    if (g.id !== e.pointerId) return;
    const dx = e.clientX - g.startX;
    const elapsed = Math.max(1, Date.now() - g.startT);
    const fast = Math.abs(dx) / elapsed > SWIPE_VELOCITY_PX_MS && Math.abs(dx) > 24;
    const committed = g.axis === 'x' && (Math.abs(dx) > SWIPE_DISTANCE_PX || fast);
    if (g.moved) suppressClickUntil.current = Date.now() + 250;
    resetGesture();
    if (committed) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  if (!current?.image_url) return null;

  const animationClass =
    directionRef.current === 0
      ? ''
      : directionRef.current > 0
        ? 'lx-lightbox-from-right'
        : 'lx-lightbox-from-left';

  return createPortal(
    <div
      className="lx-modal-overlay fixed inset-0 z-[130] flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Full size picture"
      onClick={() => {
        if (Date.now() < suppressClickUntil.current) return;
        onClose();
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white backdrop-blur transition hover:bg-white/20"
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
              goPrev();
            }}
            className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:left-4 sm:flex"
            aria-label="Previous picture"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:right-4 sm:flex"
            aria-label="Next picture"
          >
            <Chevron direction="right" />
          </button>
        </>
      )}

      <div
        className="flex h-full w-full select-none flex-col items-center justify-center px-2 sm:px-16"
        style={{ touchAction: 'pan-y pinch-zoom' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={resetGesture}
      >
        <img
          key={current.image_url}
          src={current.image_url}
          alt={alt}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className={`max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl ${animationClass}`}
          style={{
            transform: dragX ? `translateX(${dragX}px)` : undefined,
            transition: dragging ? 'none' : 'transform 180ms ease-out',
            opacity: dragging ? Math.max(0.55, 1 - Math.abs(dragX) / 600) : 1,
          }}
        />
        {hasMultiple && (
          <div
            className="mt-4 flex flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {slides.length <= 8 && (
              <div className="flex items-center gap-1.5" aria-hidden>
                {slides.map((s, i) => (
                  <span
                    key={s.id ?? i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}
            <p className="text-sm text-white/80">
              {index + 1} of {slides.length}
              <span className="sm:hidden"> · swipe for more</span>
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
