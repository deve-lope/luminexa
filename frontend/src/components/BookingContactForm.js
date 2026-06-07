import React, { useState } from 'react';
import { userAPI } from '../utils/api';

export default function BookingContactForm({ user, onSaved }) {
  const [phone, setPhone] = useState(user?.phone || '');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await userAPI.updateProfile({ full_name: fullName, phone: phone.trim() });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save your details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-semibold text-amber-900">Contact details required to book</h3>
      <p className="mt-1 text-sm text-amber-900/80">
        Email and mobile number are required when booking. You can skip them at signup.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full min-h-[48px] rounded-lg border border-slate-200 px-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input value={user?.email || ''} readOnly className="w-full min-h-[48px] rounded-lg border border-slate-200 bg-slate-100 px-3 text-slate-600" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Mobile number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="+1 555 123 4567"
            className="w-full min-h-[48px] rounded-lg border border-slate-200 px-3"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-[48px] rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save & continue'}
        </button>
      </div>
    </form>
  );
}
