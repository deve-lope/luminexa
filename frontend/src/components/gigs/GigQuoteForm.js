import React, { useEffect, useState } from 'react';

export default function GigQuoteForm({
  onSubmit,
  initialData = null,
  loading = false,
  onWithdraw = null,
  withdrawBusy = false,
}) {
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
    if (!description) nextErrors.description = 'Describe what this bid covers.';
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
    <form onSubmit={handleSubmit} className="gig-pin-sheet space-y-3 !pt-10">
      <h3 className="font-bold tracking-tight text-slate-900">
        {initialData ? 'Update your bid' : 'Place a bid'}
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
            className="lx-input text-sm"
            required
          />
        </div>
        {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          What this bid covers *
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          maxLength={1500}
          rows={4}
          className="lx-input resize-y text-sm"
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
            className="lx-input w-32 text-sm"
          />
          <span className="text-sm text-slate-500">days</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={loading || withdrawBusy}
          className="lx-btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? 'Saving…' : initialData ? 'Update bid' : 'Place bid'}
        </button>
        {onWithdraw && (
          <button
            type="button"
            disabled={loading || withdrawBusy}
            onClick={() => {
              if (!window.confirm('Withdraw this bid? You can place a new one later.')) return;
              onWithdraw();
            }}
            className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            {withdrawBusy ? 'Withdrawing…' : 'Withdraw bid'}
          </button>
        )}
      </div>
    </form>
  );
}
