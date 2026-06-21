import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import { providerRequestDetail, providerRequests } from '../../utils/providerPaths';
import parseApiError from '../../utils/parseApiError';

export default function ProviderNotificationsPage() {
  const { orgSlug } = useProviderOrg();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    jobsAPI
      .getProviderDashboard(orgSlug)
      .then((res) => setData(res.data))
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [load]);

  if (loading && !data) {
    return <p className="text-center text-slate-500 py-12">Loading…</p>;
  }

  const pending = data?.pending_requests || [];
  const inquiries = data?.customer_inquiries || [];
  const notifications = data?.notifications || [];

  return (
    <div className="space-y-6 pb-8">
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <p className="text-sm text-slate-600">
        Scheduling alerts live here. Approve bookings and chat with customers in{' '}
        <Link to={providerRequests(orgSlug)} className="font-medium text-luminexa-accent">
          Service requests
        </Link>
        .
      </p>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-slate-500">
          Pending bookings ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No requests waiting for approval.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pending.map((b) => (
              <li key={b.id}>
                <Link
                  to={providerRequestDetail(orgSlug, 'booking', b.id)}
                  className="block rounded-lg border border-amber-100 bg-amber-50/50 p-3"
                >
                  <p className="font-medium text-slate-900">{b.service_name}</p>
                  <p className="text-sm text-slate-600">{b.customer_name}</p>
                  <p className="text-xs text-slate-500">{formatWhen(b.start_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-slate-500">
          Custom requests ({inquiries.length})
        </h2>
        {inquiries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No open custom requests.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {inquiries.map((inq) => (
              <li key={inq.id}>
                <Link
                  to={providerRequestDetail(orgSlug, 'inquiry', inq.id)}
                  className="block rounded-lg border border-slate-100 p-3"
                >
                  <p className="font-medium text-slate-900">
                    {inq.service_name || inq.service_label}
                  </p>
                  <p className="text-sm text-slate-600">{inq.customer_name}</p>
                  {inq.preferred_date && (
                    <p className="mt-1 text-xs text-slate-500">Preferred: {inq.preferred_date}</p>
                  )}
                  <p className="mt-1 line-clamp-2 text-sm text-slate-700">{inq.message}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {notifications.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Scheduling alerts</h2>
          <ul className="mt-3 space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
                {n.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
