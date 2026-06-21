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
      <p className="text-sm text-slate-600">
        Booking requests and custom service messages from customers — approve, track status, and chat
        in one place.
      </p>

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

      {loading && <p className="text-center text-slate-500 py-8">Loading requests…</p>}

      {!loading && !items.length && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
          <p className="font-medium text-slate-900">No requests here</p>
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
                className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:ring-violet-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{item.customer_name}</p>
                  </div>
                  <StatusBadge kind={item.kind} status={item.status} />
                </div>
                {item.start_at && (
                  <p className="mt-2 text-sm text-slate-500">{formatWhen(item.start_at)}</p>
                )}
                {!item.start_at && item.preferred_date && (
                  <p className="mt-2 text-sm text-slate-500">Preferred: {item.preferred_date}</p>
                )}
                {item.summary && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-700">{item.summary}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span>{item.kind === 'booking' ? 'Booking' : 'Custom request'}</span>
                  {item.message_count > 0 && (
                    <span>
                      {item.message_count} message{item.message_count === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
