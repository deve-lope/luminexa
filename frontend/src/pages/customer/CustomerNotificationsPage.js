import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import parseApiError from '../../utils/parseApiError';
import { useToast } from '../../contexts/ToastContext';
import {
  NOTIFICATIONS_CHANGED_EVENT,
  dismissAllNotifications,
  dismissNotificationQuietly,
  emitNotificationsChanged,
  notificationDestination,
} from '../../utils/customerNotifications';

export default function CustomerNotificationsPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissingAll, setDismissingAll] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listMyNotifications({ include_dismissed: 1 })
      .then((res) => setNotifications(res.data?.results || []))
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60000);
    const onChanged = () => load();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
  }, [load]);

  const unread = useMemo(
    () => notifications.filter((n) => !n.is_read && !n.dismissed_at),
    [notifications],
  );
  const earlier = useMemo(
    () => notifications.filter((n) => n.is_read || n.dismissed_at),
    [notifications],
  );

  const dismissNotification = async (id) => {
    try {
      await jobsAPI.dismissMyNotification(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, is_read: true, dismissed_at: n.dismissed_at || new Date().toISOString() }
            : n,
        ),
      );
      emitNotificationsChanged();
    } catch {
      showToast('Could not dismiss notification.', 'error');
    }
  };

  const openNotification = async (n) => {
    if (!n.is_read && !n.dismissed_at) {
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === n.id
            ? { ...x, is_read: true, dismissed_at: x.dismissed_at || new Date().toISOString() }
            : x,
        ),
      );
      await dismissNotificationQuietly(n.id);
    }
    navigate(notificationDestination(n));
  };

  const dismissAll = async () => {
    if (dismissingAll || unread.length === 0) return;
    setDismissingAll(true);
    try {
      await dismissAllNotifications();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          dismissed_at: n.dismissed_at || new Date().toISOString(),
        })),
      );
      showToast('All updates marked as read.', 'success');
    } catch {
      showToast('Could not mark updates as read.', 'error');
    } finally {
      setDismissingAll(false);
    }
  };

  if (loading && notifications.length === 0) {
    return <p className="py-12 text-center text-slate-500">Loading…</p>;
  }

  const renderItem = (n, { showDismiss = false } = {}) => (
    <li
      key={n.id}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
        n.is_read || n.dismissed_at
          ? 'border-slate-200 bg-white'
          : 'border-teal-100 bg-teal-50/80'
      }`}
    >
      <button
        type="button"
        onClick={() => openNotification(n)}
        className="min-w-0 flex-1 text-left"
      >
        <p className={`text-sm text-slate-900 ${n.is_read || n.dismissed_at ? 'font-normal' : 'font-bold'}`}>
          {n.title}
        </p>
        <p className="mt-0.5 text-sm text-slate-700">{n.message}</p>
        {n.created_at && (
          <p className="mt-1 text-xs text-slate-500">{formatWhen(n.created_at)}</p>
        )}
        <span className="mt-2 inline-flex text-sm font-medium text-luminexa-accent">
          View details →
        </span>
      </button>
      {showDismiss && (
        <button
          type="button"
          onClick={() => dismissNotification(n.id)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      )}
    </li>
  );

  return (
    <div className="space-y-4 pb-8">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-600">
          All booking updates, invoices, and alerts. New items are listed first; earlier ones below.
        </p>
        {unread.length > 0 && (
          <button
            type="button"
            disabled={dismissingAll}
            onClick={dismissAll}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          >
            {dismissingAll ? 'Updating…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="lx-empty">
          <p className="text-sm font-medium text-slate-800">No notifications yet</p>
          <p className="lx-muted mt-1">Updates from providers will show up here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">
              New {unread.length > 0 ? `(${unread.length})` : ''}
            </h2>
            {unread.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center">
                <p className="text-sm font-medium text-slate-800">No new notifications</p>
                <p className="mt-1 text-sm text-slate-500">You&apos;re all caught up.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {unread.map((n) => renderItem(n, { showDismiss: true }))}
              </ul>
            )}
          </section>

          {earlier.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Earlier</h2>
              <ul className="space-y-2">
                {earlier.map((n) => renderItem(n))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
