import React, { useEffect, useState } from 'react';

const HOUSE_TYPES = [
  'detached',
  'townhouse',
  'duplex',
  'shared_driveway',
  'commercial',
  'other',
];
const WORK_TYPES = ['roadside', 'driveway', 'front', 'full'];
const FREQUENCIES = ['seasonal', 'monthly', 'one_time'];

const emptyForm = {
  region: '',
  customer: '',
  service_line1: '',
  service_line2: '',
  service_city: '',
  service_region: '',
  service_postal: '',
  service_country: 'CA',
  house_type: 'detached',
  work_type: 'driveway',
  frequency: 'seasonal',
  contract_start: '',
  contract_end: '',
  payment_status: 'unpaid',
  payment_method: '',
  notes: '',
  is_active: true,
};

export default function PropertyForm({ initial, regions, customers, onSubmit, onCancel, busy }) {
  const [form, setForm] = useState({ ...emptyForm, ...initial });

  useEffect(() => {
    setForm({ ...emptyForm, ...initial });
  }, [initial]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Region</span>
        <select
          className="lx-input mt-1 w-full"
          value={form.region}
          required
          onChange={(e) => set('region', e.target.value)}
        >
          <option value="">Select region</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      {customers?.length > 0 && (
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Customer</span>
          <select
            className="lx-input mt-1 w-full"
            value={form.customer}
            required
            onChange={(e) => set('customer', e.target.value)}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.user_id || c.id} value={c.user_id || c.id}>
                {c.display_name || c.email || c.user_id}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm">
        <span className="font-medium text-slate-700">Address line 1</span>
        <input
          className="lx-input mt-1 w-full"
          value={form.service_line1}
          required
          onChange={(e) => set('service_line1', e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Address line 2</span>
        <input
          className="lx-input mt-1 w-full"
          value={form.service_line2}
          onChange={(e) => set('service_line2', e.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">City</span>
          <input
            className="lx-input mt-1 w-full"
            value={form.service_city}
            required
            onChange={(e) => set('service_city', e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Province</span>
          <input
            className="lx-input mt-1 w-full"
            value={form.service_region}
            required
            onChange={(e) => set('service_region', e.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Postal code</span>
        <input
          className="lx-input mt-1 w-full"
          value={form.service_postal}
          required
          onChange={(e) => set('service_postal', e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">House type</span>
          <select
            className="lx-input mt-1 w-full"
            value={form.house_type}
            onChange={(e) => set('house_type', e.target.value)}
          >
            {HOUSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Work type</span>
          <select
            className="lx-input mt-1 w-full"
            value={form.work_type}
            onChange={(e) => set('work_type', e.target.value)}
          >
            {WORK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-slate-700">Frequency</span>
        <select
          className="lx-input mt-1 w-full"
          value={form.frequency}
          onChange={(e) => set('frequency', e.target.value)}
        >
          {FREQUENCIES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </label>

      {form.frequency !== 'one_time' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Contract start</span>
            <input
              type="date"
              className="lx-input mt-1 w-full"
              value={form.contract_start}
              required
              onChange={(e) => set('contract_start', e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Contract end</span>
            <input
              type="date"
              className="lx-input mt-1 w-full"
              value={form.contract_end}
              required
              onChange={(e) => set('contract_end', e.target.value)}
            />
          </label>
        </div>
      )}

      <label className="block text-sm">
        <span className="font-medium text-slate-700">Gate / crew notes</span>
        <textarea
          className="lx-input mt-1 w-full min-h-[72px]"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-2 pt-2">
        <button type="submit" disabled={busy} className="lx-btn-primary min-h-[44px] flex-1">
          {busy ? 'Saving…' : 'Save property'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="lx-btn-secondary min-h-[44px]">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
