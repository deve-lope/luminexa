import React, { useCallback, useState } from 'react';
import PictureLightbox from './PictureLightbox';

/** Storefront gallery grid — tap a photo to expand; swipe/arrows if more than one. */
export default function ExpandableGallery({ images, fallbackAlt = '' }) {
  const slides = (images || []).filter((img) => img?.image_url);
  const [openIndex, setOpenIndex] = useState(null);
  const close = useCallback(() => setOpenIndex(null), []);

  const goPrev = useCallback(() => {
    setOpenIndex((i) => (i === 0 ? slides.length - 1 : i - 1));
  }, [slides.length]);

  const goNext = useCallback(() => {
    setOpenIndex((i) => (i === slides.length - 1 ? 0 : i + 1));
  }, [slides.length]);

  if (!slides.length) return null;

  const current = openIndex != null ? slides[openIndex] : null;

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slides.map((img, i) => (
          <button
            key={img.id || img.image_url || i}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="overflow-hidden rounded-lg text-left cursor-zoom-in"
            aria-label={`View gallery photo ${i + 1} larger`}
          >
            <img
              src={img.image_url}
              alt={img.caption || fallbackAlt}
              className="aspect-square w-full object-cover"
              draggable={false}
            />
          </button>
        ))}
      </div>
      {openIndex != null && current && (
        <PictureLightbox
          slides={slides}
          index={openIndex}
          alt={current.caption || fallbackAlt}
          onClose={close}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
    </>
  );
}
