import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const GAP_PX = 12;

function PictureLightbox({ slides, index, alt, onClose, onPrev, onNext }) {
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

export default function ServicePictureCarousel({ images, alt = '' }) {
  const slides = useMemo(
    () => (images || []).filter((img) => img?.image_url),
    [images]
  );
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanScrollPrev(track.scrollLeft > 4);
    setCanScrollNext(track.scrollLeft < maxScroll - 4);

    const children = Array.from(track.children);
    const trackLeft = track.scrollLeft;
    const trackCenter = trackLeft + track.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;
    children.forEach((child, i) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(childCenter - trackCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setIndex(closest);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    updateScrollState();
    track.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      track.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [slides.length, updateScrollState]);

  const scrollByStep = useCallback((direction) => {
    const track = trackRef.current;
    const slide = track?.children[0];
    if (!track || !slide) return;
    const step = slide.offsetWidth + GAP_PX;
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  }, []);

  const openLightbox = (slideIndex) => {
    setIndex(slideIndex);
    setLightboxOpen(true);
  };

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  if (!slides.length) return null;

  const hasMultiple = slides.length > 1;
  const singleSlide = slides.length === 1;

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Pictures
      </h2>

      <div className="relative mt-2">
        <div
          ref={trackRef}
          className={`flex snap-x snap-mandatory scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            singleSlide ? '' : 'gap-3 overflow-x-auto'
          }`}
        >
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => openLightbox(i)}
              className={`group shrink-0 snap-start overflow-hidden rounded-xl bg-slate-100 text-left ${
                singleSlide
                  ? 'w-full max-w-sm'
                  : 'w-[78%] sm:w-[46%] lg:w-[31%]'
              }`}
              aria-label={`View picture ${i + 1} full size`}
            >
              <img
                src={slide.image_url}
                alt={alt}
                className="h-36 w-full object-cover transition group-hover:opacity-95 sm:h-40"
                draggable={false}
              />
            </button>
          ))}
        </div>

        {hasMultiple && (
          <>
            {canScrollPrev && (
              <button
                type="button"
                onClick={() => scrollByStep(-1)}
                className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 shadow-md transition hover:bg-slate-50"
                aria-label="Scroll to previous pictures"
              >
                ‹
              </button>
            )}
            {canScrollNext && (
              <button
                type="button"
                onClick={() => scrollByStep(1)}
                className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 shadow-md transition hover:bg-slate-50"
                aria-label="Scroll to next pictures"
              >
                ›
              </button>
            )}
          </>
        )}
      </div>

      {lightboxOpen && (
        <PictureLightbox
          slides={slides}
          index={index}
          alt={alt}
          onClose={closeLightbox}
          onPrev={() => setIndex((i) => (i === 0 ? slides.length - 1 : i - 1))}
          onNext={() => setIndex((i) => (i === slides.length - 1 ? 0 : i + 1))}
        />
      )}
    </section>
  );
}
