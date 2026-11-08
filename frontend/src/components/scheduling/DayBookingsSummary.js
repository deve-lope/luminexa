import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatTime } from '../../utils/datetime';
import { withReturnTo } from '../../utils/navigationBack';
import { providerRequestDetail, providerScheduleDetail } from '../../utils/providerPaths';
import { slotLocalDayKey } from '../../utils/slotCalendar';

function bookingDetailPath(orgSlug, job, returnTo) {
  if (!orgSlug || !job?.booking_id) return null;
  const status = (job.booking_status || '').toLowerCase();
  const path =
    status === 'requested' || status === 'quoted'
      ? providerRequestDetail(orgSlug, 'booking', job.booking_id)
      : providerScheduleDetail(orgSlug, 'booking', job.booking_id);
  return withReturnTo(path, returnTo);
}

function statusLabel(status) {
  const s = (status || '').toLowerCase();
  if (s === 'requested') return 'Awaiting confirm';
  if (s === 'quoted') return 'Quoted';
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'in_progress') return 'In progress';
  if (s === 'needs_return') return 'Needs return';
  if (s === 'pending') return 'Pending';
  return status ? status.replace(/_/g, ' ') : '';
}

function fromBooking(b) {
  if (!b?.id) return null;
  return {
    booking_id: b.id,
    booking_status: b.status || '',
    start_at: b.start_at,
    end_at: b.end_at,
    customer_name: b.customer_name || '',
    service_name: b.service_name || b.job_title || '',
    service_address: b.service_address || '',
  };
}

function fromSlot(slot) {
  if (!slot?.booking_id) return null;
  return {
    booking_id: slot.booking_id,
    booking_status: slot.booking_status || '',
    start_at: slot.start_at,
    end_at: slot.end_at,
    customer_name: slot.customer_name || '',
    service_name: slot.service_name || '',
    service_address: slot.service_address || '',
  };
}

/**
 * Jobs on the selected day: short details + Show more (whole card tappable on phone).
 * Prefers real booking rows; falls back to booked availability slots.
 */
export default function DayBookingsSummary({
  orgSlug,
  dayKey,
  bookings = [],
  slots = [],
  returnTo,
}) {
  const jobs = useMemo(() => {
    const byId = new Map();

    for (const b of bookings || []) {
      if (dayKey && slotLocalDayKey(b.start_at) !== dayKey) continue;
      const row = fromBooking(b);
      if (!row || byId.has(row.booking_id)) continue;
      byId.set(row.booking_id, row);
    }

    for (const slot of slots || []) {
      if (dayKey && slotLocalDayKey(slot.start_at) !== dayKey) continue;
      const row = fromSlot(slot);
      if (!row || byId.has(row.booking_id)) continue;
      byId.set(row.booking_id, row);
    }

    return [...byId.values()].sort(
      (a, b) => new Date(a.start_at) - new Date(b.start_at),
    );
  }, [bookings, slots, dayKey]);

  if (!jobs.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Jobs this day · {jobs.length}
      </p>
      <ul className="space-y-2">
        {jobs.map((job) => {
          const path = bookingDetailPath(orgSlug, job, returnTo);
          const timeLabel = `${formatTime(job.start_at)}${
            job.end_at ? ` – ${formatTime(job.end_at)}` : ''
          }`;
          const customer = (job.customer_name || '').trim() || 'Customer';
          const service = (job.service_name || '').trim() || 'Service';
          const address = (job.service_address || '').trim();
          const label = statusLabel(job.booking_status);

          const body = (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{customer}</p>
                <p className="mt-0.5 truncate text-sm text-slate-700">{service}</p>
                <p className="mt-1 text-xs text-slate-500">{timeLabel}</p>
                {address ? (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{address}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">
                    Address from customer when they confirm
                  </p>
                )}
                {label && (
                  <p className="mt-1.5 text-[11px] font-medium capitalize text-violet-700">
                    {label}
                  </p>
                )}
              </div>
              <span className="shrink-0 self-center rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 ring-1 ring-violet-100">
                Show more
              </span>
            </>
          );

          return (
            <li key={job.booking_id}>
              {path ? (
                <Link
                  to={path}
                  className="flex min-h-[56px] items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm active:bg-violet-50"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
