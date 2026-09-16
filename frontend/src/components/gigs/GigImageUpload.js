import React, { useRef, useState } from 'react';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/gif',
]);
const EXT_OK = /\.(jpe?g|png|webp|gif)$/i;

function extFromType(type) {
  const t = (type || '').toLowerCase();
  if (t === 'image/png' || t === 'image/x-png') return '.png';
  if (t === 'image/webp') return '.webp';
  if (t === 'image/gif') return '.gif';
  return '.jpg';
}

function isHeic(file) {
  const type = (file.type || '').toLowerCase();
  const name = file.name || '';
  return type.includes('heic') || type.includes('heif') || /\.hei[cf]$/i.test(name);
}

function normalizeGigImageFile(file) {
  if (isHeic(file)) {
    throw new Error(
      'HEIC photos aren’t supported. Choose a JPEG or PNG, or set the camera to JPEG.',
    );
  }
  const type = (file.type || '').toLowerCase();
  if (type && !ACCEPT_MIME.has(type)) {
    throw new Error('Use a JPEG, PNG, WebP, or GIF image.');
  }
  const name = file.name || '';
  if (EXT_OK.test(name)) return file;
  const nextName = `photo${extFromType(type)}`;
  const nextType = type && ACCEPT_MIME.has(type) ? type : 'image/jpeg';
  return new File([file], nextName, { type: nextType });
}

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
    try {
      const normalized = normalizeGigImageFile(file);
      setError('');
      onAdd?.(normalized);
    } catch (err) {
      setError(err?.message || 'Use a JPEG, PNG, WebP, or GIF image.');
    }
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
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
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
      <p className="text-xs text-slate-500">JPEG, PNG, WebP, or GIF · max 5 MB each</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
