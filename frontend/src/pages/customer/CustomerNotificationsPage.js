import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import parseApiError from '../../utils/parseApiError';
import { useToast } from '../../contexts/ToastContext';

export default function CustomerNotificationsPage() {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listMyNotifications()
      .then((res) => setNotifications(res.data?.results || []))
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [load]);

  const dismissNotification = async (id) => {
    try {
      await jobsAPI.dismissMyNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      showToast('Could not dismiss notification.', 'error');
    }
  };

  if (loading && notifications.length === 0) {
    return <p className="py-12 text-center text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-4 pb-8">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <p className="text-sm text-slate-600">
        Booking updates, invoices, and other alerts from your providers.
      </p>

      {notifications.length === 0 ? (
        <div className="lx-empty">
          <p className="text-sm font-medium text-slate-800">You&apos;re all caught up</p>
          <p className="lx-muted mt-1">New updates from providers will show up here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className="flex items-start gap-3 rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                <p className="mt-0.5 text-sm text-slate-700">{n.message}</p>
                {n.created_at && (
                  <p className="mt-1 text-xs text-slate-500">{formatWhen(n.created_at)}</p>
                )}
                {n.link_path && (
                  <Link
                    to={n.link_path}
                    className="mt-2 inline-flex text-sm font-medium text-luminexa-accent"
                  >
                    View details →
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissNotification(n.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800"
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
