import React, { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';

/**
 * Invoice payment reminders + default labor rate for job costing.
 */
export default function ProviderBooksSettings({ orgSlug, isOwner }) {
  const [enabled, setEnabled] = useState(true);
  const [daysText, setDaysText] = useState('3, 7, 14');
  const [laborRate, setLaborRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchOrg = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError('');
    try {
      const res = await jobsAPI.getOrganization(orgSlug);
      const d = res.data;
      setEnabled(d.invoice_followup_enabled !== false);
      const days =
        Array.isArray(d.invoice_followup_days) && d.invoice_followup_days.length
          ? d.invoice_followup_days
          : [3, 7, 14];
      setDaysText(days.join(', '));
      setLaborRate(d.default_labor_rate != null ? String(d.default_labor_rate) : '');
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const save = async () => {
    if (!isOwner) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const days = daysText
        .split(/[,\s]+/)
        .map((x) => parseInt(x, 10))
        .filter((n) => !Number.isNaN(n) && n > 0);
      await jobsAPI.patchOrganization(orgSlug, {
        invoice_followup_enabled: enabled,
        invoice_followup_days: days.length ? days : [3, 7, 14],
        default_labor_rate: laborRate === '' ? null : laborRate,
      });
      setMessage('Books settings saved.');
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="lx-card">
        <p className="text-sm text-slate-500">Loading books settings…</p>
      </section>
    );
  }

  return (
    <section className="lx-card space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase text-slate-500">Business books</h2>
        <p className="mt-1 text-sm text-slate-600">
          Automatic unpaid-invoice emails and a default labor rate for job costing. Analytics and
          CSV export are under Analytics &amp; books.
        </p>
      </div>

      <label className="flex items-center gap-3 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!isOwner}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Email customers payment reminders for unpaid invoices
      </label>

      <div>
        <label className="text-xs font-semibold uppercase text-slate-500">
          Reminder days after issue
        </label>
        <input
          value={daysText}
          disabled={!isOwner || !enabled}
          onChange={(e) => setDaysText(e.target.value)}
          className="lx-input mt-1 w-full"
          placeholder="3, 7, 14"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase text-slate-500">
          Default labor rate ($ / hour)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={laborRate}
          disabled={!isOwner}
          onChange={(e) => setLaborRate(e.target.value)}
          className="lx-input mt-1 w-full"
          placeholder="Optional"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      {isOwner && (
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save books settings'}
        </button>
      )}
    </section>
  );
}
