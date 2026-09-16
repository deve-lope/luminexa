import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GigImageUpload from '../../components/gigs/GigImageUpload';
import { businessesAPI, jobsAPI } from '../../utils/api';
import { customerGigDetail, customerGigs } from '../../utils/customerPaths';
import { validatePostalCode } from '../../utils/postalInput';

export default function CreateGigPostPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location_address: '',
    location_city: '',
    location_state: '',
    location_postal_code: '',
    search_radius_miles: 25,
  });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    businessesAPI
      .listBusinessTypes()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setCategories(list.filter((c) => c.is_active !== false));
      })
      .catch(() => setCategories([]));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    const city = (formData.location_city || '').trim();
    const postalCheck = validatePostalCode(formData.location_postal_code);
    if (city.length < 2 || !postalCheck.valid) {
      const next = {};
      if (city.length < 2) next.location_city = 'City is required.';
      if (!postalCheck.valid) next.location_postal_code = postalCheck.error || 'Postal / ZIP code is required.';
      next.detail = next.location_city || next.location_postal_code;
      setErrors(next);
      setLoading(false);
      return;
    }
    try {
      const payload = {
        ...formData,
        category: formData.category || null,
        location_city: city,
        location_postal_code: postalCheck.normalized,
        search_radius_miles: Number(formData.search_radius_miles) || 25,
      };
      const res = await jobsAPI.createGig(payload);
      const gigId = res.data?.id;
      if (!gigId) {
        setErrors({ detail: 'Post created but no id returned. Please refresh the gig wall.' });
        return;
      }
      for (const file of pendingFiles) {
        await jobsAPI.uploadGigImage(gigId, file);
      }
      navigate(customerGigDetail(gigId));
    } catch (err) {
      const data = err?.response?.data || {};
      if (data && typeof data === 'object') {
        const flat = {};
        Object.entries(data).forEach(([key, val]) => {
          flat[key] = Array.isArray(val) ? val.join(' ') : String(val);
        });
        if (!flat.detail) {
          const first = Object.values(flat).find(Boolean);
          flat.detail = first || 'Could not create gig post.';
        }
        setErrors(flat);
      } else {
        setErrors({ detail: 'Could not create gig post.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const previews = pendingFiles.map((file, idx) => ({
    id: idx,
    preview: URL.createObjectURL(file),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-luminexa-ink">Post a request</h1>
        <Link to={customerGigs()} className="text-sm font-medium text-teal-700 hover:underline">
          Back to gig wall
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-luminexa-line bg-white p-4 shadow-lx-soft">
        {errors.detail && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{errors.detail}</p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-luminexa-ink">Title *</label>
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            maxLength={200}
            className="w-full rounded-xl border border-luminexa-line px-3 py-2 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
          />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-luminexa-ink">Description *</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            maxLength={2000}
            rows={5}
            className="w-full rounded-xl border border-luminexa-line px-3 py-2 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
          />
          <div className="mt-1 text-xs text-slate-500">{formData.description.length}/2000</div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-luminexa-ink">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full rounded-xl border border-luminexa-line px-3 py-2 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.slug || c.id} value={c.slug || ''}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-luminexa-ink">Address</label>
            <input
              name="location_address"
              value={formData.location_address}
              onChange={handleChange}
              className="w-full rounded-xl border border-luminexa-line px-3 py-2 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-luminexa-ink">City *</label>
            <input
              name="location_city"
              value={formData.location_city}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={120}
              className="w-full rounded-xl border border-luminexa-line px-3 py-2 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
            {errors.location_city && <p className="mt-1 text-sm text-red-600">{errors.location_city}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-luminexa-ink">State / province</label>
            <input
              name="location_state"
              value={formData.location_state}
              onChange={handleChange}
              className="w-full rounded-xl border border-luminexa-line px-3 py-2 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-luminexa-ink">Postal / ZIP code *</label>
            <input
              name="location_postal_code"
              value={formData.location_postal_code}
              onChange={handleChange}
              required
              autoComplete="postal-code"
              className="w-full rounded-xl border border-luminexa-line px-3 py-2 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
            {errors.location_postal_code && (
              <p className="mt-1 text-sm text-red-600">{errors.location_postal_code}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-luminexa-ink">
              Search radius: {formData.search_radius_miles} mi
            </label>
            <input
              type="range"
              name="search_radius_miles"
              min="1"
              max="100"
              value={formData.search_radius_miles}
              onChange={handleChange}
              className="w-full accent-teal-700"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-luminexa-ink">Photos (max 2)</label>
          <GigImageUpload
            images={previews}
            onAdd={(file) => setPendingFiles((prev) => [...prev, file].slice(0, 2))}
            onRemove={(idx) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
            maxImages={2}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
        >
          {loading ? 'Posting…' : 'Post to gig wall'}
        </button>
      </form>
    </div>
  );
}
