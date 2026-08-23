import React, { useCallback, useState } from 'react';
import PictureLightbox from './PictureLightbox';

/** Click a photo to open it full-screen (same overlay as service pictures). */
export default function ExpandablePhoto({
  src,
  alt = '',
  buttonClassName = '',
  imgClassName = 'h-full w-full object-cover',
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
        aria-label={alt ? `View ${alt} larger` : 'View photo larger'}
      >
        <img src={src} alt={alt} className={imgClassName} draggable={false} />
      </button>
      {open && (
        <PictureLightbox
          slides={[{ image_url: src }]}
          index={0}
          alt={alt}
          onClose={close}
          onPrev={close}
          onNext={close}
        />
      )}
    </>
  );
}
