import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { businessesAPI, orgProfileAPI } from '../../utils/api';
import { providerSettings } from '../../utils/providerPaths';

function parseUploadError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail);
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Upload failed.';
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

  const uploadBanner = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !orgSlug) return;
    const fd = new FormData();
    fd.append('banner', file);
    setUploading('banner');
    setError(null);
    try {
      await orgProfileAPI.patchOrganization(orgSlug, fd);
      setMessage('Cover photo updated.');
      notifyMediaChange();
    } catch (err) {
      setError(parseUploadError(err));
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !orgSlug) return;
    const fd = new FormData();
    fd.append('logo', file);
    setUploading('logo');
    setError(null);
    try {
      await orgProfileAPI.patchOrganization(orgSlug, fd);
      setMessage('Logo updated.');
      notifyMediaChange();
    } catch (err) {
      setError(parseUploadError(err));
    } finally {
      setUploading(null);
      e.target.value = '';
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
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase text-slate-500">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">
        Cover photo, logo, bio, service area, and gallery — everything customers see at the top of
        your booking page.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Cover photo</label>
          {bannerUrl && (
            <img
              src={bannerUrl}
              alt=""
              className="mt-2 h-28 w-full rounded-lg object-cover"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={uploadBanner}
            disabled={uploading === 'banner'}
            className="mt-2 block w-full text-sm"
          />
          {uploading === 'banner' && (
            <p className="mt-1 text-xs text-slate-500">Uploading cover…</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Logo</label>
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              className="mt-2 h-16 w-16 rounded-lg border border-slate-200 object-cover"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={uploadLogo}
            disabled={uploading === 'logo'}
            className="mt-2 block w-full text-sm"
          />
          {uploading === 'logo' && <p className="mt-1 text-xs text-slate-500">Uploading logo…</p>}
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
          className="w-full min-h-[44px] rounded-lg border border-slate-200 font-medium disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-medium text-slate-800">Gallery ({gallery.length}/5)</h3>
        <input
          type="file"
          accept="image/*"
          onChange={uploadGallery}
          disabled={uploading === 'gallery' || gallery.length >= 5}
          className="mt-2 block w-full text-sm"
        />
        {uploading === 'gallery' && (
          <p className="mt-1 text-xs text-slate-500">Uploading to gallery…</p>
        )}
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
    </section>
  );
}
