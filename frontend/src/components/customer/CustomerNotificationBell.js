import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { IconBell } from '../icons/NavIcons';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import { customerNotifications } from '../../utils/customerPaths';
import {
  dismissNotificationQuietly,
  emitNotificationsChanged,
  notificationDestination,
} from '../../utils/customerNotifications';

const PREVIEW_LIMIT = 2;

export default function CustomerNotificationBell({ unreadCount = 0, onCountChange }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const loadPreview = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listMyNotifications()
      .then((res) => {
        const list = res.data?.results || [];
        const unread = list.filter((n) => !n.is_read && !n.dismissed_at);
        setItems(unread.slice(0, PREVIEW_LIMIT));
        onCountChange?.(Number(res.data?.count) || unread.length);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [onCountChange]);

  useEffect(() => {
    if (!open) return undefined;
    loadPreview();
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, loadPreview]);

  const openNotification = async (n) => {
    setOpen(false);
    if (!n.is_read && !n.dismissed_at) {
      await dismissNotificationQuietly(n.id);
      emitNotificationsChanged();
    }
    navigate(notificationDestination(n));
  };

  const goShowAll = () => {
    setOpen(false);
    navigate(customerNotifications());
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <IconBell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-start justify-end bg-slate-900/40 p-3 pt-[max(0.75rem,var(--lx-sat))] sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-notif-preview-title"
            onClick={() => setOpen(false)}
          >
            <div
              className="mt-12 w-full max-w-sm rounded-3xl bg-white p-4 shadow-lx-elevated sm:mt-14"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    id="customer-notif-preview-title"
                    className="text-base font-semibold tracking-tight text-slate-900"
                  >
                    New updates
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600">
                    Latest unread alerts from your providers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {loading && items.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
                ) : items.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-center">
                    <p className="text-sm font-medium text-slate-800">No new notifications</p>
                    <p className="mt-1 text-sm text-slate-500">You&apos;re all caught up.</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {items.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => openNotification(n)}
                          className="w-full rounded-2xl border border-teal-100 bg-teal-50/80 px-3 py-3 text-left"
                        >
                          <p className="text-sm font-bold text-slate-900">{n.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-sm text-slate-700">{n.message}</p>
                          {n.created_at && (
                            <p className="mt-1 text-xs text-slate-500">{formatWhen(n.created_at)}</p>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                onClick={goShowAll}
                className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Show all
              </button>
              <Link
                to={customerNotifications()}
                onClick={() => setOpen(false)}
                className="mt-2 block text-center text-xs text-slate-500 hover:text-slate-700"
              >
                Includes earlier updates
              </Link>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
