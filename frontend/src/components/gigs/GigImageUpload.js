import React, { useRef, useState } from 'react';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif';

export default function GigImageUpload({
  images = [],
  onAdd,
  onRemove,
  maxImages = 2,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (images.length >= maxImages) {
      setError(`Maximum ${maxImages} images.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Each image must be 5 MB or smaller.');
      return;
    }
    setError('');
    onAdd?.(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {images.map((img, idx) => {
          const src = img.preview || img.image || img.url;
          const key = img.id || img.preview || idx;
          return (
            <div key={key} className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
              {src ? (
                <img src={src} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-100 text-xs text-slate-500">
                  Image
                </div>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove?.(img.id ?? idx)}
                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || images.length >= maxImages}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || images.length >= maxImages}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
      >
        Add photo ({images.length}/{maxImages})
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
