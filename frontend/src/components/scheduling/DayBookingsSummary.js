import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatTime } from '../../utils/datetime';
import { withReturnTo } from '../../utils/navigationBack';
import { providerRequestDetail, providerScheduleDetail } from '../../utils/providerPaths';

function bookingDetailPath(orgSlug, slot, returnTo) {
  if (!orgSlug || !slot?.booking_id) return null;
  const status = (slot.booking_status || '').toLowerCase();
  const path =
    status === 'requested' || status === 'quoted'
      ? providerRequestDetail(orgSlug, 'booking', slot.booking_id)
      : providerScheduleDetail(orgSlug, 'booking', slot.booking_id);
  return withReturnTo(path, returnTo);
}

function statusLabel(status) {
  const s = (status || '').toLowerCase();
  if (s === 'requested') return 'Awaiting confirm';
  if (s === 'quoted') return 'Quoted';
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'in_progress') return 'In progress';
  if (s === 'pending') return 'Pending';
  return status ? status.replace(/_/g, ' ') : '';
}

/** Unique bookings on the selected day, with short details + link to full page. */
export default function DayBookingsSummary({ orgSlug, slots, returnTo }) {
  const jobs = useMemo(() => {
    const byId = new Map();
    for (const slot of slots || []) {
      if (!slot?.booking_id) continue;
      if (byId.has(slot.booking_id)) continue;
      byId.set(slot.booking_id, slot);
    }
    return [...byId.values()].sort(
      (a, b) => new Date(a.start_at) - new Date(b.start_at),
    );
  }, [slots]);

  if (!jobs.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Jobs this day · {jobs.length}
      </p>
      <ul className="space-y-2">
        {jobs.map((slot) => {
          const path = bookingDetailPath(orgSlug, slot, returnTo);
          const timeLabel = `${formatTime(slot.start_at)}${
            slot.end_at ? ` – ${formatTime(slot.end_at)}` : ''
          }`;
          const customer = (slot.customer_name || '').trim() || 'Customer';
          const service = (slot.service_name || '').trim() || 'Service';
          const address = (slot.service_address || '').trim();
          const label = statusLabel(slot.booking_status);

          return (
            <li
              key={slot.booking_id}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{customer}</p>
                  <p className="mt-0.5 truncate text-sm text-slate-700">{service}</p>
                  <p className="mt-1 text-xs text-slate-500">{timeLabel}</p>
                  {address ? (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{address}</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">Address pending</p>
                  )}
                  {label && (
                    <p className="mt-1.5 text-[11px] font-medium capitalize text-violet-700">
                      {label}
                    </p>
                  )}
                </div>
                {path && (
                  <Link
                    to={path}
                    className="shrink-0 rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 ring-1 ring-violet-100 active:bg-violet-100"
                  >
                    Show more
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
