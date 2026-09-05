import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import BookingCalendar from './BookingCalendar';
import ConfirmDialog from '../ConfirmDialog';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { businessesAPI, jobsAPI } from '../../utils/api';
import { formatTimeRange, formatWhen } from '../../utils/datetime';
import parseApiError from '../../utils/parseApiError';
import { providerCustomerKey } from '../../utils/providerRouteKey';
import { calendarDataForMonth, firstBookableDayKey, normalizeBookingCalendar } from '../../utils/slotCalendar';

const REASON_MAX = 500;

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
  const [submittingId, setSubmittingId] = useState(null);
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
    if (open) {
      setReason('');
      setPendingSlot(null);
      loadCalendar();
    }
  }, [open, loadCalendar]);

  const { days: calendarDays, slots_by_day: slotsByDay } = useMemo(
    () => calendarDataForMonth(calendar, year, month),
    [calendar, year, month]
  );

  const calendarInSync = calendar?.year === year && calendar?.month === month;

  const slots = useMemo(() => {
    if (!selectedDay) return [];
    return (slotsByDay[selectedDay] || []).filter((s) => s.available);
  }, [slotsByDay, selectedDay]);

  const reschedule = async (slotId) => {
    setSubmittingId(slotId);
    setError(null);
    try {
      const trimmed = reason.trim();
      const payload = showReason && trimmed ? { reason: trimmed } : {};
      const res = await jobsAPI.rescheduleBooking(booking.id, slotId, payload);
      setPendingSlot(null);
      onRescheduled?.(res.data);
      onClose();
    } catch (e) {
      setError(parseApiError(e));
      setPendingSlot(null);
    } finally {
      setSubmittingId(null);
    }
  };

  if (!open || !booking) return null;

  const confirmBusy = submittingId != null;
  const pendingLabel = pendingSlot
    ? formatWhen(pendingSlot.start_at) || formatTimeRange(pendingSlot.start_at, pendingSlot.end_at)
    : '';

  return createPortal(
    <>
      <div className="lx-modal-overlay fixed inset-0 z-[110] flex items-end justify-center bg-black/40 sm:items-center">
        <div className="lx-modal-sheet max-h-[90vh] max-w-lg">
          <div className="flex items-start justify-between border-b border-slate-100 p-4">
            <div>
              <h2 className="font-semibold text-slate-900">Reschedule appointment</h2>
              <p className="mt-1 text-sm text-slate-600">{booking.service_name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={confirmBusy}
              className="text-sm text-slate-500 disabled:opacity-60"
            >
              Close
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto p-4">
            {audience === 'customer' && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                {booking?.status === 'requested'
                  ? 'Pick a new open slot. Your request stays pending until the business approves the updated time.'
                  : 'Pick a new time below. Your request will be sent to the business for approval — including if your original appointment was already confirmed.'}
              </p>
            )}
            {audience === 'provider' && (
              <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-900">
                Pick a new open slot. The customer will be notified of the updated time.
              </p>
            )}
            {showReason && (
              <div>
                <label htmlFor="reschedule-reason" className="mb-1 block text-sm font-medium text-slate-700">
                  Reason for customer (optional)
                </label>
                <textarea
                  id="reschedule-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
                  rows={2}
                  placeholder="e.g. Tech unavailable — proposing the next open slot"
                  disabled={confirmBusy}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 disabled:opacity-60"
                />
              </div>
            )}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            {calendarFetching || !calendarInSync ? (
              <p className="text-center text-slate-500 py-8">Loading calendar…</p>
            ) : (
              <>
                <BookingCalendar
                  year={year}
                  month={month}
                  days={calendarDays}
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
                {selectedDay && slots.length === 0 && (
                  <p className="text-sm text-slate-500">No open slots this day.</p>
                )}
                <ul className="space-y-2">
                  {slots.map((slot) => (
                    <li key={slot.id}>
                      <button
                        type="button"
                        disabled={confirmBusy}
                        onClick={() => setPendingSlot(slot)}
                        className="flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-800 disabled:opacity-50"
                      >
                        <span>{formatTimeRange(slot.start_at, slot.end_at)}</span>
                        <span className="text-luminexa-accent">Select</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingSlot)}
        title={audience === 'provider' ? 'Propose this new time?' : 'Request this new time?'}
        message={
          audience === 'provider'
            ? `The customer will be asked to accept ${pendingLabel}. This replaces the current appointment time.`
            : `Ask the business to move your appointment to ${pendingLabel}?`
        }
        confirmLabel={audience === 'provider' ? 'Send new time' : 'Request reschedule'}
        cancelLabel="Back"
        tone="default"
        busy={confirmBusy}
        onConfirm={() => pendingSlot && reschedule(pendingSlot.id)}
        onClose={() => {
          if (!confirmBusy) setPendingSlot(null);
        }}
      />
    </>,
    document.body
  );
}
