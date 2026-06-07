import React, { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';

const MAX_IMAGES = 5;
const MAX_BYTES = 3 * 1024 * 1024;

function parseUploadError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail);
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Upload failed.';
}

export default function ServiceGalleryEditor({ serviceId, onChange }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const { data } = await jobsAPI.listServiceGallery(serviceId);
      setImages(data || []);
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !serviceId) return;
    if (images.length >= MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images per service.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Each image must be 3 MB or smaller.');
      e.target.value = '';
      return;
    }
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append('image', file);
    try {
      await jobsAPI.uploadServiceGalleryImage(serviceId, fd);
      await load();
      onChange?.();
    } catch (err) {
      setError(parseUploadError(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const remove = async (imageId) => {
    if (!serviceId) return;
    setError(null);
    try {
      await jobsAPI.deleteServiceGalleryImage(serviceId, imageId);
      await load();
      onChange?.();
    } catch (err) {
      setError(parseUploadError(err));
    }
  };

  if (!serviceId) {
    return (
      <p className="text-xs text-slate-500">
        Save the service first, then you can add photos.
      </p>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-medium text-slate-700">
        Photos ({images.length}/{MAX_IMAGES})
      </h4>
      <p className="mt-0.5 text-xs text-slate-500">Up to 5 images, 3 MB each.</p>
      <input
        type="file"
        accept="image/*"
        onChange={upload}
        disabled={uploading || images.length >= MAX_IMAGES}
        className="mt-2 block w-full text-xs text-slate-600"
      />
      {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {loading ? (
        <p className="mt-2 text-xs text-slate-500">Loading photos…</p>
      ) : images.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {images.map((img) => (
            <figure key={img.id} className="relative overflow-hidden rounded-lg">
              <img
                src={img.image_url}
                alt=""
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(img.id)}
                className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white"
              >
                Remove
              </button>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}
