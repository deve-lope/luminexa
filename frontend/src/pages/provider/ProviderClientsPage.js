import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Skeleton from '../../components/Skeleton';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { providerClientDetail } from '../../utils/providerPaths';
import parseApiError from '../../utils/parseApiError';

export default function ProviderClientsPage() {
  const { orgSlug } = useProviderOrg();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('approved');

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    setError('');
    jobsAPI
      .listOrgCustomers(orgSlug, { status })
      .then((res) => setCustomers(res.data || []))
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Your customers, balances, and notes — open a client for history and invoices.
      </p>

      <div className="flex gap-2">
        {['approved', 'pending', 'blocked', 'all'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
              status === s ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : !customers.length ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-lx-soft ring-1 ring-slate-100">
          No customers in this list yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-lx-soft ring-1 ring-slate-100">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                to={providerClientDetail(orgSlug, c.id)}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {c.full_name || c.email}
                  </p>
                  <p className="truncate text-xs text-slate-500">{c.email}</p>
                </div>
                <span className="shrink-0 text-xs font-medium capitalize text-slate-400">
                  {c.customer_status || '—'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
