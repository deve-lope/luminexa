import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { useToast } from '../../contexts/ToastContext';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import parseApiError from '../../utils/parseApiError';
import { providerNotifications } from '../../utils/providerPaths';
import {
  dismissProviderNotificationQuietly,
  emitProviderNotificationsChanged,
  providerNotificationDestination,
} from '../../utils/providerNotifications';

export default function ProviderNotificationsAllPage() {
  const { orgSlug } = useProviderOrg();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dismissingAll, setDismissingAll] = useState(false);

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    jobsAPI
      .listProviderNotifications(orgSlug, { include_dismissed: 1 })
      .then((res) => setNotifications(res.data?.results || []))
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const unread = useMemo(
    () => notifications.filter((n) => !n.is_read && !n.dismissed_at),
    [notifications],
  );

  const markRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, is_read: true, dismissed_at: n.dismissed_at || new Date().toISOString() }
          : n,
      ),
    );
    await dismissProviderNotificationQuietly(orgSlug, id);
  };

  const openNotification = async (n) => {
    if (!n.is_read && !n.dismissed_at) {
      await markRead(n.id);
    }
    navigate(providerNotificationDestination(orgSlug, n));
  };

  const markAllRead = async () => {
    if (dismissingAll || unread.length === 0) return;
    setDismissingAll(true);
    try {
      await Promise.all(unread.map((n) => jobsAPI.dismissNotification(orgSlug, n.id)));
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          dismissed_at: n.dismissed_at || new Date().toISOString(),
        })),
      );
      emitProviderNotificationsChanged();
      showToast('All updates marked as read.', 'success');
    } catch {
      showToast('Could not mark updates as read.', 'error');
      load();
    } finally {
      setDismissingAll(false);
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

      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to={providerNotifications(orgSlug)} className="lx-link inline-flex min-h-[36px] items-center text-sm">
            ← Notifications
          </Link>
          <p className="mt-2 text-sm text-slate-600">
            All booking and schedule updates. Unread items are shown in bold.
          </p>
        </div>
        {unread.length > 0 && (
          <button
            type="button"
            disabled={dismissingAll}
            onClick={markAllRead}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          >
            {dismissingAll ? 'Updating…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="lx-empty">
          <p className="text-sm font-medium text-slate-800">No updates yet</p>
          <p className="lx-muted mt-1">Alerts about bookings and schedule will show up here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const isUnread = !n.is_read && !n.dismissed_at;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    isUnread
                      ? 'border-teal-100 bg-teal-50/70'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <p
                    className={`text-sm text-slate-900 ${
                      isUnread ? 'font-bold' : 'font-normal text-slate-600'
                    }`}
                  >
                    {n.message}
                  </p>
                  {n.created_at && (
                    <p className="mt-1 text-xs text-slate-500">{formatWhen(n.created_at)}</p>
                  )}
                  <span className="mt-2 inline-flex text-sm font-medium text-luminexa-accent">
                    View →
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
