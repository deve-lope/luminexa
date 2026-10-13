import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import BookingCalendar from './BookingCalendar';
import CustomerSlotTimeButton from './CustomerSlotTimeButton';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { businessesAPI, jobsAPI } from '../../utils/api';
import { formatTimeRange, formatWhen } from '../../utils/datetime';
import parseApiError from '../../utils/parseApiError';
import { providerCustomerKey } from '../../utils/providerRouteKey';
import { calendarDataForMonth, firstBookableDayKey, normalizeBookingCalendar } from '../../utils/slotCalendar';

const REASON_MAX = 500;

function slotDateLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function RescheduleBookingModal({
  open,
  onClose,
  booking,
  onRescheduled,
  audience = 'customer',
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [calendar, setCalendar] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [calendarFetching, setCalendarFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reason, setReason] = useState('');
  const [pendingSlot, setPendingSlot] = useState(null);

  useModalBodyLock(open && Boolean(booking));

  const orgSlug = providerCustomerKey(booking);
  const serviceId = booking?.service;
  const showReason = audience === 'provider';

  const loadCalendar = useCallback(() => {
    if (!orgSlug || !serviceId) return;
    setCalendarFetching(true);
    setError(null);
    businessesAPI
      .getServiceCalendar(orgSlug, serviceId, { year, month })
      .then((res) => {
        setCalendar(res.data);
        const normalized = normalizeBookingCalendar(res.data);
        const days = normalized?.days || {};
        const firstAvailable = firstBookableDayKey(days);
        setSelectedDay((prev) => {
          if (prev && days[prev]?.status === 'available') return prev;
          return firstAvailable || null;
        });
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setCalendarFetching(false));
  }, [orgSlug, serviceId, year, month]);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setPendingSlot(null);
    setError(null);
    setSubmitting(false);
  }, [open, booking?.id]);

  useEffect(() => {
    if (open && !pendingSlot) loadCalendar();
  }, [open, pendingSlot, loadCalendar]);

  const { days: calendarDays, slots_by_day: slotsByDay } = useMemo(
    () => calendarDataForMonth(calendar, year, month),
    [calendar, year, month]
  );

  const calendarInSync = calendar?.year === year && calendar?.month === month;

  const slots = useMemo(() => {
    if (!selectedDay) return [];
    return (slotsByDay[selectedDay] || []).filter((s) => s.available);
  }, [slotsByDay, selectedDay]);

  const reschedule = async () => {
    if (!pendingSlot?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = reason.trim();
      const payload = showReason && trimmed ? { reason: trimmed } : {};
      const res = await jobsAPI.rescheduleBooking(booking.id, pendingSlot.id, payload);
      setPendingSlot(null);
      onRescheduled?.(res.data);
      onClose();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !booking) return null;

  const currentWhen = formatWhen(booking.start_at);
  const newDate = pendingSlot ? slotDateLabel(pendingSlot.start_at) : '';
  const newTime = pendingSlot
    ? formatTimeRange(pendingSlot.start_at, pendingSlot.end_at)
    : '';

  return createPortal(
    <div className="lx-modal-overlay fixed inset-0 z-[110] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="lx-modal-sheet max-h-[90vh] max-w-lg">
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              {pendingSlot ? 'Confirm new time' : 'Reschedule appointment'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{booking.service_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-sm text-slate-500 disabled:opacity-60"
          >
            Close
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {pendingSlot ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                {audience === 'provider'
                  ? 'Confirm this date and time. The customer will be asked to accept it.'
                  : 'Confirm this date and time before we send your reschedule request.'}
              </p>
              {currentWhen ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Current appointment
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{currentWhen}</p>
                </div>
              ) : null}
              <div className="rounded-2xl border-2 border-teal-200 bg-teal-50/80 px-4 py-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-800">
                  New date
                </p>
                <p className="mt-1 text-lg font-bold tracking-tight text-slate-900">{newDate}</p>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-teal-800">
                  New time
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-slate-900">
                  {newTime}
                </p>
              </div>
              {showReason && reason.trim() ? (
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Reason: </span>
                  {reason.trim()}
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={reschedule}
                  className="lx-btn-primary min-h-[48px] flex-1 disabled:opacity-60"
                >
                  {submitting
                    ? 'Saving…'
                    : audience === 'provider'
                      ? 'Confirm & send new time'
                      : 'Confirm reschedule request'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setPendingSlot(null)}
                  className="lx-btn-ghost min-h-[48px] flex-1 disabled:opacity-60"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <>
              {audience === 'customer' && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                  {booking?.status === 'requested'
                    ? 'Pick a new open slot. You will confirm the date and time next. Your request stays pending until the business approves.'
                    : 'Pick a new time below, then confirm. Your request will be sent to the business for approval.'}
                </p>
              )}
              {audience === 'provider' && (
                <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-900">
                  Pick a new open slot, then confirm the date and time. The customer will be notified.
                </p>
              )}
              {showReason && (
                <div>
                  <label
                    htmlFor="reschedule-reason"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Reason for customer (optional)
                  </label>
                  <textarea
                    id="reschedule-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
                    rows={2}
                    placeholder="e.g. Tech unavailable — proposing the next open slot"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                  />
                </div>
              )}
              {!calendar && calendarFetching ? (
                <p className="py-8 text-center text-slate-500">Loading calendar…</p>
              ) : (
                <>
                  <div className="relative">
                    {calendarFetching && (
                      <p className="pointer-events-none absolute right-1 top-1 z-10 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-sm">
                        Updating…
                      </p>
                    )}
                    <BookingCalendar
                      year={year}
                      month={month}
                      days={calendarInSync ? calendarDays : {}}
                      selectedDay={selectedDay}
                      onSelectDay={setSelectedDay}
                      onPrevMonth={() => {
                        if (month === 1) {
                          setYear((y) => y - 1);
                          setMonth(12);
                        } else setMonth((m) => m - 1);
                      }}
                      onNextMonth={() => {
                        if (month === 12) {
                          setYear((y) => y + 1);
                          setMonth(1);
                        } else setMonth((m) => m + 1);
                      }}
                      size="compact"
                      openOnly
                    />
                  </div>
                  {calendarInSync && selectedDay && slots.length === 0 && (
                    <p className="text-sm text-slate-500">No open slots this day.</p>
                  )}
                  {calendarInSync && selectedDay && slots.length > 0 ? (
                    <ul className="grid grid-cols-2 gap-2">
                      {slots.map((slot) => (
                        <li key={slot.id}>
                          <CustomerSlotTimeButton
                            slot={slot}
                            selected={false}
                            onSelect={() => setPendingSlot(slot)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : calendarFetching && calendar ? (
                    <p className="text-sm text-slate-500">Loading times…</p>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
