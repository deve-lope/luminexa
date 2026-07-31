import React, { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import {
  blobToFile,
  getCroppedImageBlob,
} from '../../utils/cropImage';

/**
 * Full-screen sheet on mobile, centered dialog on desktop.
 * Locked aspect ratio with drag / pinch / wheel zoom + slider.
 */
export default function ImageCropDialog({
  open,
  imageSrc,
  title = 'Crop photo',
  aspect,
  exportWidth,
  exportHeight,
  mimeType = 'image/webp',
  quality = 0.9,
  fileName = 'crop.webp',
  onCancel,
  onApply,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setWorking(false);
    setError(null);
    const onKey = (e) => {
      if (e.key === 'Escape' && !working) onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, imageSrc, onCancel, working]);

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  if (!open || !imageSrc) return null;

  const apply = async () => {
    if (!croppedAreaPixels || working) return;
    setWorking(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, {
        exportWidth,
        exportHeight,
        mimeType,
        quality,
      });
      const file = blobToFile(blob, fileName);
      await onApply?.(file);
    } catch (e) {
      setError(e?.message || 'Could not crop image.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/50 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex h-full w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[min(92vh,720px)] sm:max-w-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        <div className="relative min-h-[50vh] flex-1 bg-slate-900 sm:min-h-[360px]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
            showGrid
          />
        </div>

        <div className="shrink-0 space-y-3 border-t border-slate-100 px-4 py-4">
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <span className="w-12 shrink-0 font-medium">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="min-h-[44px] w-full accent-teal-700"
              aria-label="Zoom"
            />
          </label>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={working}
              className="min-h-[48px] flex-1 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={working || !croppedAreaPixels}
              className="min-h-[48px] flex-1 rounded-xl bg-luminexa-accent text-sm font-medium text-white disabled:opacity-60"
            >
              {working ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
