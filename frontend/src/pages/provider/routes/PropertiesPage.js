import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProviderOrg } from '../../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../../utils/api';
import parseApiError from '../../../utils/parseApiError';
import { CONTRACT_STATUS_FILTERS, formatPropertyAddress } from '../../../utils/snowDispatch';
import PropertyForm from './PropertyForm';

export default function PropertiesPage() {
  const { orgSlug } = useProviderOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const regionFilter = searchParams.get('region') || '';
  const [properties, setProperties] = useState([]);
  const [regions, setRegions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    setError('');
    const params = {};
    if (statusFilter === 'unpaid') params.payment_status = 'unpaid';
    else if (statusFilter) params.status = statusFilter;
    if (regionFilter) params.region = regionFilter;
    Promise.all([
      jobsAPI.listDispatchProperties(orgSlug, params),
      jobsAPI.listDispatchRegions(orgSlug),
      jobsAPI.listOrgCustomers(orgSlug, { status: 'approved' }).catch(() => ({ data: [] })),
    ])
      .then(([pRes, rRes, cRes]) => {
        setProperties(Array.isArray(pRes.data) ? pRes.data : pRes.data?.results || []);
        setRegions(Array.isArray(rRes.data) ? rRes.data : rRes.data?.results || []);
        setCustomers(Array.isArray(cRes.data) ? cRes.data : []);
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug, statusFilter, regionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const saveProperty = async (form) => {
    setBusy(true);
    setError('');
    try {
      const payload = { ...form };
      if (modal?.id) {
        await jobsAPI.patchDispatchProperty(orgSlug, modal.id, payload);
      } else {
        await jobsAPI.createDispatchProperty(orgSlug, payload);
      }
      setModal(null);
      load();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const togglePaid = async (prop) => {
    setBusy(true);
    try {
      await jobsAPI.patchDispatchProperty(orgSlug, prop.id, {
        payment_status: prop.payment_status === 'paid' ? 'unpaid' : 'paid',
        payment_method: prop.payment_status === 'paid' ? '' : 'cash',
        paid_at: prop.payment_status === 'paid' ? null : new Date().toISOString().slice(0, 10),
      });
      load();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Properties</h1>
          <p className="mt-1 text-sm text-slate-600">Contracts and service addresses by region.</p>
        </div>
        <button
          type="button"
          className="lx-btn-primary shrink-0 px-4 py-2 text-sm"
          onClick={() => setModal({})}
        >
          Add
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {CONTRACT_STATUS_FILTERS.map((f) => (
          <button
            key={f.id || 'all'}
            type="button"
            onClick={() => setFilter('status', f.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
              statusFilter === f.id
                ? 'bg-teal-50 text-teal-800 ring-teal-300'
                : 'bg-white text-slate-600 ring-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <select
        className="lx-input w-full text-sm"
        value={regionFilter}
        onChange={(e) => setFilter('region', e.target.value)}
      >
        <option value="">All regions</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      <ul className="space-y-3">
        {properties.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 whitespace-pre-wrap">
                  {formatPropertyAddress(p)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {p.region_name || 'Region'} · {p.frequency?.replace(/_/g, ' ')} ·{' '}
                  {p.contract_status || p.status || '—'}
                </p>
              </div>
              {p.payment_status === 'unpaid' && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                  Unpaid
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="text-sm font-medium text-luminexa-accent"
                onClick={() => setModal(p)}
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                className="text-sm font-medium text-slate-600"
                onClick={() => togglePaid(p)}
              >
                {p.payment_status === 'paid' ? 'Mark unpaid' : 'Mark paid (cash)'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!loading && !properties.length && (
        <p className="text-center text-sm text-slate-500">No properties match these filters.</p>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {modal.id ? 'Edit property' : 'Add property'}
            </h2>
            <div className="mt-4">
              <PropertyForm
                initial={modal}
                regions={regions}
                customers={customers}
                busy={busy}
                onCancel={() => setModal(null)}
                onSubmit={saveProperty}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
