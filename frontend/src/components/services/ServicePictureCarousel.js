import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PictureLightbox from '../ui/PictureLightbox';

const GAP_PX = 12;

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
  const indexRef = useRef(0);

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

  indexRef.current = index;

  const openLightbox = (slideIndex) => {
    setIndex(slideIndex);
    setLightboxOpen(true);
  };

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    // Bring the strip to the picture the viewer ended on.
    const track = trackRef.current;
    const slide = track?.children[indexRef.current];
    if (track && slide) {
      track.scrollTo({ left: Math.max(0, slide.offsetLeft - 4), behavior: 'smooth' });
    }
  }, []);

  if (!slides.length) return null;

  const hasMultiple = slides.length > 1;
  const singleSlide = slides.length === 1;

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="lx-eyebrow">Pictures</h2>
        {hasMultiple && (
          <span className="text-xs font-medium tabular-nums text-slate-500">
            {index + 1} / {slides.length}
          </span>
        )}
      </div>

      <div className="relative mt-3">
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
              className={`group relative shrink-0 snap-start overflow-hidden rounded-2xl bg-slate-100 text-left shadow-lx-card ring-1 ring-slate-200/70 outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 ${
                singleSlide
                  ? 'w-full sm:max-w-md'
                  : 'w-[82%] sm:w-[46%] lg:w-[31%]'
              }`}
              aria-label={`View picture ${i + 1} full size`}
            >
              <img
                src={slide.image_url}
                alt={alt}
                className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                draggable={false}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
              <span
                className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white opacity-90 backdrop-blur-sm"
                aria-hidden
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                </svg>
              </span>
            </button>
          ))}
        </div>

        {hasMultiple && (
          <>
            {canScrollPrev && (
              <button
                type="button"
                onClick={() => scrollByStep(-1)}
                className="absolute left-0 top-1/2 z-10 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 shadow-md transition hover:bg-slate-50 sm:flex"
                aria-label="Scroll to previous pictures"
              >
                ‹
              </button>
            )}
            {canScrollNext && (
              <button
                type="button"
                onClick={() => scrollByStep(1)}
                className="absolute right-0 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 shadow-md transition hover:bg-slate-50 sm:flex"
                aria-label="Scroll to next pictures"
              >
                ›
              </button>
            )}
          </>
        )}
      </div>

      {hasMultiple && slides.length <= 8 && (
        <div className="mt-2 flex justify-center gap-1.5 sm:hidden" aria-hidden>
          {slides.map((slide, i) => (
            <span
              key={slide.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-5 bg-luminexa-accent' : 'w-1.5 bg-slate-300'
              }`}
            />
          ))}
        </div>
      )}

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
