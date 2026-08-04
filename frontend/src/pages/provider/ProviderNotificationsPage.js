import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import {
  providerNotificationsAll,
  providerRequestDetail,
  providerRequests,
  providerSchedule,
} from '../../utils/providerPaths';
import parseApiError from '../../utils/parseApiError';

function sortKey(item) {
  if (item.type === 'booking') return new Date(item.start_at || 0).getTime();
  return new Date(item.created_at || 0).getTime();
}

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

  const pendingItems = useMemo(() => {
    const bookings = (data?.pending_requests || []).map((b) => ({
      type: 'booking',
      id: b.id,
      title: b.service_name,
      customer_name: b.customer_name,
      start_at: b.start_at,
      status: b.status,
    }));
    const inquiries = (data?.customer_inquiries || []).map((inq) => ({
      type: 'inquiry',
      id: inq.id,
      title: inq.service_name || inq.service_label || 'Custom request',
      customer_name: inq.customer_name,
      preferred_date: inq.preferred_date,
      message: inq.message,
      created_at: inq.created_at,
    }));
    return [...bookings, ...inquiries].sort((a, b) => sortKey(b) - sortKey(a));
  }, [data]);

  const notifications = data?.notifications || [];

  if (loading && !data) {
    return <p className="py-12 text-center text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-6 pb-8">
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <p className="text-sm text-slate-600">
        Requests waiting for you and booking alerts. Open a request to approve, quote, or chat — or see{' '}
        <Link to={providerRequests(orgSlug)} className="font-medium text-luminexa-accent">
          Service requests
        </Link>
        .
      </p>

      <section className="lx-card">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            Pending requests ({pendingItems.length})
          </h2>
          {pendingItems.length > 0 && (
            <Link to={providerRequests(orgSlug)} className="lx-link shrink-0 text-sm">
              See all
            </Link>
          )}
        </div>
        {pendingItems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No requests waiting for approval.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pendingItems.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <Link
                  to={providerRequestDetail(orgSlug, item.type, item.id)}
                  className="block rounded-xl border border-amber-100 bg-amber-50/50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800 ring-1 ring-amber-200/80">
                      {item.type === 'inquiry' ? 'Custom' : 'Booking'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{item.customer_name}</p>
                  {item.type === 'booking' && item.start_at && (
                    <p className="mt-1 text-xs text-slate-500">{formatWhen(item.start_at)}</p>
                  )}
                  {item.type === 'inquiry' && item.preferred_date && (
                    <p className="mt-1 text-xs text-slate-500">Preferred: {item.preferred_date}</p>
                  )}
                  {item.type === 'inquiry' && item.message && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-700">{item.message}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lx-card">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            Updates {notifications.length > 0 ? `(${notifications.length})` : ''}
          </h2>
          <Link to={providerNotificationsAll(orgSlug)} className="lx-link shrink-0 text-sm">
            Show all
          </Link>
        </div>
        {notifications.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No new alerts. Show all for earlier updates.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notifications.slice(0, 5).map((n) => {
              const toRequests =
                n.kind === 'new_customer_booking' ||
                n.kind === 'customer_cancelled_booking' ||
                n.kind === 'customer_reschedule_request';
              return (
                <li key={n.id}>
                  <Link
                    to={toRequests ? providerRequests(orgSlug) : providerSchedule(orgSlug)}
                    className="block rounded-xl border border-violet-100 bg-violet-50/70 p-3 text-sm text-violet-950"
                  >
                    <p className="font-semibold">{n.message}</p>
                    {n.created_at && (
                      <p className="mt-1 text-xs text-violet-800/70">{formatWhen(n.created_at)}</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
