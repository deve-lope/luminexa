import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ImageCropDialog from '../media/ImageCropDialog';
import { businessesAPI, orgProfileAPI } from '../../utils/api';
import {
  COVER_CROP,
  LOGO_CROP,
  validateImageSourceFile,
} from '../../utils/cropImage';
import { providerSettings } from '../../utils/providerPaths';

function parseUploadError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail);
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Upload failed.';
}

function ImageFileButton({
  id,
  label,
  accept,
  onChange,
  disabled,
  busyLabel,
  busy = false,
}) {
  return (
    <div className="mt-2">
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <label
        htmlFor={id}
        className={`lx-btn-secondary w-full cursor-pointer sm:w-auto ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {busy ? busyLabel : label}
      </label>
    </div>
  );
}

export default function ProviderProfileEditor({ orgSlug, onMediaChange, title = 'Page appearance & bio' }) {
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [cropState, setCropState] = useState(null);
  const cropObjectUrlRef = useRef(null);

  const clearCropObjectUrl = useCallback(() => {
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
      cropObjectUrlRef.current = null;
    }
  }, []);

  const closeCrop = useCallback(() => {
    clearCropObjectUrl();
    setCropState(null);
  }, [clearCropObjectUrl]);

  const refreshPreview = useCallback(() => {
    if (!orgSlug) return;
    businessesAPI
      .getPublicStorefront(orgSlug)
      .then((res) => {
        const org = res.data?.organization;
        if (org) {
          setTagline(org.tagline || '');
          setDescription(org.description || '');
          setBannerUrl(org.banner_url || null);
          setLogoUrl(org.logo_url || null);
        }
      })
      .catch(() => {});
  }, [orgSlug]);

  const loadGallery = useCallback(() => {
    if (!orgSlug) return;
    orgProfileAPI
      .listGallery(orgSlug)
      .then((res) => {
        setGallery(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {});
  }, [orgSlug]);

  useEffect(() => {
    refreshPreview();
    loadGallery();
  }, [refreshPreview, loadGallery]);

  useEffect(() => () => clearCropObjectUrl(), [clearCropObjectUrl]);

  const notifyMediaChange = useCallback(() => {
    refreshPreview();
    loadGallery();
    onMediaChange?.();
  }, [refreshPreview, loadGallery, onMediaChange]);

  const saveText = async () => {
    if (!orgSlug) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await orgProfileAPI.patchOrganization(orgSlug, {
        tagline,
        description,
      });
      setMessage('Profile saved.');
      notifyMediaChange();
    } catch (err) {
      setError(parseUploadError(err));
    } finally {
      setSaving(false);
    }
  };

  const beginCrop = (file, kind) => {
    const config = kind === 'banner' ? COVER_CROP : LOGO_CROP;
    const validationError = validateImageSourceFile(file, { maxBytes: config.maxSourceBytes });
    if (validationError) {
      setError(validationError);
      return;
    }
    clearCropObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    cropObjectUrlRef.current = objectUrl;
    setError(null);
    setCropState({
      kind,
      imageSrc: objectUrl,
      aspect: config.aspect,
      exportWidth: config.exportWidth,
      exportHeight: config.exportHeight,
      mimeType: config.mimeType,
      quality: config.quality,
      fileName: kind === 'banner' ? 'cover.webp' : 'logo.webp',
      title: kind === 'banner' ? 'Crop cover photo' : 'Crop logo',
    });
  };

  const onBannerSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    beginCrop(file, 'banner');
  };

  const onLogoSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    beginCrop(file, 'logo');
  };

  const applyCroppedUpload = async (file) => {
    if (!orgSlug || !cropState) return;
    const field = cropState.kind === 'banner' ? 'banner' : 'logo';
    const fd = new FormData();
    fd.append(field, file);
    setUploading(field);
    setError(null);
    try {
      await orgProfileAPI.patchOrganization(orgSlug, fd);
      setMessage(field === 'banner' ? 'Cover photo updated.' : 'Logo updated.');
      closeCrop();
      notifyMediaChange();
    } catch (err) {
      const message = parseUploadError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setUploading(null);
    }
  };

  const uploadGallery = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !orgSlug) return;
    if (gallery.length >= 5) {
      setError('Maximum 5 gallery images.');
      return;
    }
    setUploading('gallery');
    setError(null);
    const fd = new FormData();
    fd.append('image', file);
    try {
      await orgProfileAPI.uploadGalleryImage(orgSlug, fd);
      setMessage('Gallery image added.');
      notifyMediaChange();
    } catch (err) {
      setError(parseUploadError(err));
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  const removeGallery = async (imageId) => {
    if (!orgSlug) return;
    setError(null);
    try {
      await orgProfileAPI.deleteGalleryImage(orgSlug, imageId);
      setMessage('Image removed.');
      notifyMediaChange();
    } catch (err) {
      setError(parseUploadError(err));
    }
  };

  return (
    <section className="lx-card">
      <h2 className="text-sm font-semibold uppercase text-slate-500">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">
        Cover photo, logo, bio, service area, and gallery — everything customers see at the top of
        your booking page.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Cover photo</label>
          <p className="mt-0.5 text-xs text-slate-500">Shown at 3:1. Cropped to 1500×500 WebP.</p>
          <div className="mt-2 aspect-[3/1] w-full overflow-hidden rounded-lg bg-slate-100">
            {bannerUrl ? (
              <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                No cover photo
              </div>
            )}
          </div>
          <ImageFileButton
            id="provider-cover-upload"
            label={bannerUrl ? 'Change cover photo' : 'Choose cover photo'}
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onBannerSelected}
            disabled={uploading === 'banner'}
            busy={uploading === 'banner'}
            busyLabel="Uploading cover…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Logo</label>
          <p className="mt-0.5 text-xs text-slate-500">Square crop, exported at 512×512 WebP.</p>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="mt-2 h-16 w-16 rounded-lg border border-slate-200 object-cover"
            />
          ) : (
            <div className="mt-2 flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[10px] text-slate-400">
              Logo
            </div>
          )}
          <ImageFileButton
            id="provider-logo-upload"
            label={logoUrl ? 'Change logo' : 'Choose logo'}
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onLogoSelected}
            disabled={uploading === 'logo'}
            busy={uploading === 'logo'}
            busyLabel="Uploading logo…"
          />
        </div>

        <label htmlFor="tagline" className="block text-sm font-medium text-slate-700">
          Tagline
        </label>
        <input
          id="tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Short headline under your business name"
        />

        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          About your business
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Describe your company, experience, and what customers can expect when they book with you."
        />

        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Set your service area (map + radius circle) in{' '}
          <Link to={providerSettings(orgSlug)} className="font-medium text-luminexa-accent">
            Settings
          </Link>
          .
        </p>

        <button
          type="button"
          onClick={saveText}
          disabled={saving || Boolean(uploading)}
          className="lx-btn-primary w-full min-h-[48px]"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-medium text-slate-800">Gallery ({gallery.length}/5)</h3>
        <ImageFileButton
          id="provider-gallery-upload"
          label={gallery.length >= 5 ? 'Gallery full (5/5)' : 'Add gallery photo'}
          accept="image/*"
          onChange={uploadGallery}
          disabled={uploading === 'gallery' || gallery.length >= 5}
          busy={uploading === 'gallery'}
          busyLabel="Uploading to gallery…"
        />
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {gallery.map((img) => (
            <li key={img.id} className="relative">
              <img src={img.image_url} alt="" className="aspect-square rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => removeGallery(img.id)}
                className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <ImageCropDialog
        open={Boolean(cropState)}
        imageSrc={cropState?.imageSrc}
        title={cropState?.title}
        aspect={cropState?.aspect}
        exportWidth={cropState?.exportWidth}
        exportHeight={cropState?.exportHeight}
        mimeType={cropState?.mimeType}
        quality={cropState?.quality}
        fileName={cropState?.fileName}
        onCancel={closeCrop}
        onApply={applyCroppedUpload}
      />
    </section>
  );
}
