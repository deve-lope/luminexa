import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import BookingCalendar from './BookingCalendar';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { businessesAPI, jobsAPI } from '../../utils/api';
import { formatTimeRange } from '../../utils/datetime';
import parseApiError from '../../utils/parseApiError';
import { providerCustomerKey } from '../../utils/providerRouteKey';
import { calendarDataForMonth, firstBookableDayKey, normalizeBookingCalendar } from '../../utils/slotCalendar';

function slotDateLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Provider flow: mark job incomplete and optionally pick a return-visit slot.
 * mode: 'full' (from in_progress) | 'schedule' (from needs_return)
 */
export default function IncompleteReturnVisitModal({
  open,
  onClose,
  booking,
  onDone,
  mode = 'full',
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [calendar, setCalendar] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [calendarFetching, setCalendarFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleLaterBusy, setScheduleLaterBusy] = useState(false);
  const [note, setNote] = useState('');
  const [pickingSlot, setPickingSlot] = useState(mode === 'schedule');
  const [pendingSlot, setPendingSlot] = useState(null);
  const [error, setError] = useState(null);

  useModalBodyLock(open && Boolean(booking));

  const orgSlug = providerCustomerKey(booking);
  const serviceId = booking?.service;

  useEffect(() => {
    if (!open) return;
    setNote('');
    setError(null);
    setPickingSlot(mode === 'schedule');
    setPendingSlot(null);
    setSelectedDay(null);
    setCalendar(null);
    setSubmitting(false);
  }, [open, mode, booking?.id]);

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
    if (open && pickingSlot && !pendingSlot) loadCalendar();
  }, [open, pickingSlot, pendingSlot, loadCalendar]);

  const { days: calendarDays, slots_by_day: slotsByDay } = useMemo(
    () => calendarDataForMonth(calendar, year, month),
    [calendar, year, month]
  );

  const calendarInSync = calendar?.year === year && calendar?.month === month;

  const slots = useMemo(() => {
    if (!selectedDay) return [];
    return (slotsByDay[selectedDay] || []).filter((s) => s.available);
  }, [slotsByDay, selectedDay]);

  const scheduleReturn = async () => {
    if (!pendingSlot?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      const api =
        mode === 'schedule'
          ? jobsAPI.scheduleReturnVisit(booking.id, { slot_id: pendingSlot.id, note })
          : jobsAPI.markBookingIncomplete(booking.id, { slot_id: pendingSlot.id, note });
      const res = await api;
      setPendingSlot(null);
      onDone?.(res.data);
      onClose();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const scheduleLater = async () => {
    setScheduleLaterBusy(true);
    setError(null);
    try {
      const res = await jobsAPI.markBookingIncomplete(booking.id, { note });
      onDone?.(res.data);
      onClose();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setScheduleLaterBusy(false);
    }
  };

  if (!open || !booking) return null;

  const title =
    mode === 'schedule' ? 'Schedule return visit' : 'Incomplete — return visit';
  const subtitle =
    mode === 'schedule'
      ? 'Pick an open slot for the follow-up visit. It stays linked to this job.'
      : 'Work was not finished. Schedule a return visit now, or mark incomplete and schedule later.';

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
              {pendingSlot ? 'Confirm return visit' : title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{booking.service_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || scheduleLaterBusy}
            className="text-sm text-slate-500 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          {pendingSlot ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Confirm this return-visit date and time before it is booked.
              </p>
              <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/80 px-4 py-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-800">
                  Return date
                </p>
                <p className="mt-1 text-lg font-bold tracking-tight text-slate-900">{newDate}</p>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-violet-800">
                  Return time
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-slate-900">
                  {newTime}
                </p>
              </div>
              {note.trim() ? (
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Note: </span>
                  {note.trim()}
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={scheduleReturn}
                  className="min-h-[48px] flex-1 rounded-xl bg-violet-600 font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? 'Booking…' : 'Confirm return visit'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setPendingSlot(null)}
                  className="min-h-[48px] flex-1 rounded-xl border border-slate-200 font-medium text-slate-800 disabled:opacity-60"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                {subtitle}
              </p>

              <div>
                <label htmlFor="return-note" className="mb-1 block text-sm font-medium text-slate-700">
                  Note for customer (optional)
                </label>
                <textarea
                  id="return-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. Waiting on a part — will finish the install"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                />
              </div>

              {!pickingSlot && mode === 'full' && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setPickingSlot(true)}
                    className="min-h-[48px] rounded-xl bg-violet-600 font-medium text-white"
                  >
                    Schedule return visit now
                  </button>
                  <button
                    type="button"
                    disabled={scheduleLaterBusy}
                    onClick={scheduleLater}
                    className="min-h-[48px] rounded-xl border border-slate-200 font-medium text-slate-800 disabled:opacity-60"
                  >
                    {scheduleLaterBusy ? 'Saving…' : 'Mark incomplete — schedule later'}
                  </button>
                </div>
              )}

              {pickingSlot && (
                <div className="space-y-3">
                  {mode === 'full' && (
                    <button
                      type="button"
                      onClick={() => setPickingSlot(false)}
                      className="text-sm font-medium text-violet-700"
                    >
                      ← Back
                    </button>
                  )}
                  <h3 className="text-sm font-semibold text-slate-800">Choose return date & time</h3>
                  <p className="text-xs text-slate-500">
                    Tap a time to review the date and time, then confirm.
                  </p>
                  {!calendar && calendarFetching ? (
                    <p className="text-sm text-slate-500">Loading calendar…</p>
                  ) : !calendar && !calendarFetching ? (
                    <p className="text-sm text-red-600">{error || 'Could not load availability.'}</p>
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
                              setMonth(12);
                              setYear((y) => y - 1);
                            } else {
                              setMonth((m) => m - 1);
                            }
                          }}
                          onNextMonth={() => {
                            if (month === 12) {
                              setMonth(1);
                              setYear((y) => y + 1);
                            } else {
                              setMonth((m) => m + 1);
                            }
                          }}
                          openOnly
                        />
                      </div>
                      {calendarInSync && selectedDay && (
                        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {slots.length === 0 ? (
                            <li className="col-span-full text-sm text-slate-500">
                              No open slots this day.
                            </li>
                          ) : (
                            slots.map((slot) => (
                              <li key={slot.id}>
                                <button
                                  type="button"
                                  onClick={() => setPendingSlot(slot)}
                                  className="min-h-[44px] w-full rounded-lg border border-slate-200 text-sm font-medium text-slate-800 hover:border-violet-300 hover:bg-violet-50"
                                >
                                  {formatTimeRange(slot.start_at, slot.end_at)}
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                      {calendarFetching && calendar ? (
                        <p className="text-sm text-slate-500">Loading times…</p>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
