import React, { useState } from 'react';
import { minutesFromHours } from '../../utils/serviceDisplay';

export default function QuickAddServicePanel({ onCreate, submitting, className = '' }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('1');
  const [price, setPrice] = useState('0');
  const [fulfillmentKind, setFulfillmentKind] = useState('mobile');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    onCreate({
      name: trimmed,
      description: description.trim(),
      duration_minutes: minutesFromHours(duration),
      base_price: price || '0',
      show_price: true,
      fulfillment_kind: fulfillmentKind,
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
            Duration (hours)
            <input
              type="number"
              min={0.25}
              step={0.25}
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
              className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-200 px-3"
            />
          </label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-600">Where is this job done?</legend>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="radio"
              name="quick-fulfillment"
              checked={fulfillmentKind === 'mobile'}
              onChange={() => setFulfillmentKind('mobile')}
              className="accent-luminexa-accent"
            />
            Mobile — you go to the customer
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="radio"
              name="quick-fulfillment"
              checked={fulfillmentKind === 'shop'}
              onChange={() => setFulfillmentKind('shop')}
              className="accent-luminexa-accent"
            />
            In-shop — customer comes to you
          </label>
        </fieldset>
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
