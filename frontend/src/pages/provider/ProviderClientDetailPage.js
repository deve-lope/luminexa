import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Skeleton from '../../components/Skeleton';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { providerClients, providerScheduleDetail } from '../../utils/providerPaths';
import parseApiError from '../../utils/parseApiError';
import { formatWhen } from '../../utils/datetime';

function money(amount, currency = 'CAD') {
  const n = Number(amount);
  if (Number.isNaN(n) || amount == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(amount);
  }
}

export default function ProviderClientDetailPage() {
  const { orgSlug } = useProviderOrg();
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    if (!orgSlug || !userId) return;
    setLoading(true);
    setError('');
    jobsAPI
      .getOrgCustomer(orgSlug, userId)
      .then((res) => {
        setData(res.data);
        setNotes(res.data.provider_notes || '');
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveNotes = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await jobsAPI.patchOrgCustomer(orgSlug, userId, {
        provider_notes: notes,
      });
      setData(res.data);
      setSaved(true);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (!data) {
    return (
      <div className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Link to={providerClients(orgSlug)} className="text-sm font-semibold text-teal-700">
          ← Clients
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to={providerClients(orgSlug)} className="text-sm font-semibold text-teal-700">
        ← Clients
      </Link>

      <section className="rounded-2xl bg-white p-5 shadow-lx-soft ring-1 ring-slate-100">
        <h2 className="text-lg font-bold text-slate-900">{data.full_name || data.email}</h2>
        <p className="mt-1 text-sm text-slate-600">{data.email}</p>
        {data.phone ? <p className="text-sm text-slate-600">{data.phone}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Outstanding</p>
            <p className="font-semibold text-slate-900">
              {money(data.outstanding_balance)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Completed jobs</p>
            <p className="font-semibold text-slate-900">{data.completed_bookings ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-lx-soft ring-1 ring-slate-100 space-y-3">
        <h3 className="text-sm font-semibold uppercase text-slate-500">Internal notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="lx-input w-full"
          placeholder="Notes only your team can see"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-700">Notes saved.</p>}
        <button
          type="button"
          disabled={saving}
          onClick={saveNotes}
          className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save notes'}
        </button>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-lx-soft ring-1 ring-slate-100">
        <h3 className="text-sm font-semibold uppercase text-slate-500">Recent bookings</h3>
        {!data.recent_bookings?.length ? (
          <p className="mt-3 text-sm text-slate-500">No bookings yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {data.recent_bookings.map((b) => (
              <li key={b.id} className="py-2">
                <Link
                  to={providerScheduleDetail(orgSlug, 'booking', b.id)}
                  className="block hover:bg-slate-50"
                >
                  <p className="font-medium text-slate-900">
                    {b.service_name || 'Booking'} · {b.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatWhen(b.start_at)}
                    {b.invoice_amount != null
                      ? ` · invoice ${money(b.invoice_amount)} (${b.invoice_status})`
                      : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
