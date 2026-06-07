import React, { useState } from 'react';

export default function QuickAddServicePanel({ onCreate, submitting, className = '' }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('60');
  const [price, setPrice] = useState('0');
  const [showPrice, setShowPrice] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    onCreate({
      name: trimmed,
      description: description.trim(),
      duration_minutes: Number(duration) || 60,
      base_price: price || '0',
      show_price: showPrice,
      is_active: true,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm ${className}`}
    >
      <h3 className="font-semibold text-slate-900">Add a service first</h3>
      <p className="mt-1 text-sm text-slate-600">
        Customers book by service. Create at least one (e.g. Plumbing, Car wash) before opening
        time slots.
      </p>
      <div className="mt-3 space-y-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Service name (e.g. Tyre change)"
          className="w-full min-h-[44px] rounded-lg border border-slate-200 px-3"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Short description (optional)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-600">
            Duration (min)
            <input
              type="number"
              min={15}
              step={15}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-200 px-3"
            />
          </label>
          <label className="text-xs text-slate-600">
            Price ($)
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={!showPrice}
              className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-200 px-3 disabled:bg-slate-100"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={showPrice}
            onChange={(e) => setShowPrice(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Show rate on public profile
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] rounded-lg bg-luminexa-accent font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create service'}
        </button>
      </div>
    </form>
  );
}
