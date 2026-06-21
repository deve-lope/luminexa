import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import { providerRequestDetail } from '../../utils/providerPaths';
import { requestFilterLabel, requestStatusLabel, requestStatusTone } from '../../utils/requestStatus';
import parseApiError from '../../utils/parseApiError';

const FILTERS = ['all', 'pending', 'active', 'done'];

function StatusBadge({ kind, status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${requestStatusTone(kind, status)}`}
    >
      {requestStatusLabel(kind, status)}
    </span>
  );
}

export default function ProviderRequestsPage() {
  const { orgSlug } = useProviderOrg();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await jobsAPI.listProviderServiceRequests(orgSlug, { filter });
      setItems(res.data?.items || []);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [orgSlug, filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
              filter === key
                ? 'bg-luminexa-accent text-white'
                : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            {requestFilterLabel(key)}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
          <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm">Loading requests…</p>
        </div>
      )}

      {!loading && !items.length && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="font-semibold text-slate-900">No requests here</p>
          <p className="mt-1 text-sm text-slate-500">
            {filter === 'all'
              ? 'When customers book or send a custom request, it will show up here.'
              : `No ${requestFilterLabel(filter).toLowerCase()} requests right now.`}
          </p>
        </div>
      )}

      {!loading && !!items.length && (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Link
                to={providerRequestDetail(orgSlug, item.kind, item.id)}
                className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:ring-violet-200 hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <StatusBadge kind={item.kind} status={item.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {item.customer_name}
                    {item.reference && (
                      <span className="ml-2 font-mono text-xs text-slate-400">{item.reference}</span>
                    )}
                  </p>
                  {item.start_at && (
                    <p className="mt-1.5 text-sm text-slate-500">{formatWhen(item.start_at)}</p>
                  )}
                  {!item.start_at && item.preferred_date && (
                    <p className="mt-1.5 text-sm text-slate-500">Preferred: {item.preferred_date}</p>
                  )}
                  {item.summary && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{item.summary}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span>{item.kind === 'booking' ? 'Booking' : 'Custom request'}</span>
                    {item.message_count > 0 && (
                      <span>· {item.message_count} message{item.message_count === 1 ? '' : 's'}</span>
                    )}
                  </div>
                </div>
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
