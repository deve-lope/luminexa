import React, { useEffect, useState } from 'react';

export default function GigQuoteForm({ onSubmit, initialData = null, loading = false }) {
  const [formData, setFormData] = useState({
    price: initialData?.price || '',
    description: initialData?.description || '',
    estimated_duration_days: initialData?.estimated_duration_days || '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        price: initialData.price || '',
        description: initialData.description || '',
        estimated_duration_days: initialData.estimated_duration_days || '',
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    const price = Number(formData.price);
    if (!price || price < 0.01) nextErrors.price = 'Enter a valid price.';
    const description = (formData.description || '').trim();
    if (!description) nextErrors.description = 'Describe what this quote covers.';
    if (description.length > 1500) nextErrors.description = 'Max 1500 characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = {
      price: String(price),
      description,
    };
    if (formData.estimated_duration_days) {
      payload.estimated_duration_days = Number(formData.estimated_duration_days);
    }
    await onSubmit?.(payload);
    if (!initialData) {
      setFormData({ price: '', description: '', estimated_duration_days: '' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">
        {initialData ? 'Update your quote' : 'Submit a quote'}
      </h3>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Price *</label>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">$</span>
          <input
            type="number"
            name="price"
            step="0.01"
            min="0.01"
            value={formData.price}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </div>
        {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          What this quote covers *
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          maxLength={1500}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <div className="mt-1 text-xs text-slate-500">{formData.description.length}/1500</div>
        {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Estimated duration (optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="estimated_duration_days"
            min="1"
            value={formData.estimated_duration_days}
            onChange={handleChange}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="text-sm text-slate-500">days</span>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Saving…' : initialData ? 'Update quote' : 'Submit quote'}
      </button>
    </form>
  );
}
