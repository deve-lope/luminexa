import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BookingCalendar from './BookingCalendar';
import { businessesAPI, jobsAPI } from '../../utils/api';
import { formatTimeRange } from '../../utils/datetime';
import parseApiError from '../../utils/parseApiError';
import { providerCustomerKey } from '../../utils/providerRouteKey';
import { calendarDataForMonth, firstBookableDayKey, normalizeBookingCalendar } from '../../utils/slotCalendar';

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
  const [submittingId, setSubmittingId] = useState(null);
  const [scheduleLaterBusy, setScheduleLaterBusy] = useState(false);
  const [note, setNote] = useState('');
  const [pickingSlot, setPickingSlot] = useState(mode === 'schedule');
  const [error, setError] = useState(null);

  const orgSlug = providerCustomerKey(booking);
  const serviceId = booking?.service;

  useEffect(() => {
    if (!open) return;
    setNote('');
    setError(null);
    setPickingSlot(mode === 'schedule');
    setSelectedDay(null);
    setCalendar(null);
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
    if (open && pickingSlot) loadCalendar();
  }, [open, pickingSlot, loadCalendar]);

  const { days: calendarDays, slots_by_day: slotsByDay } = useMemo(
    () => calendarDataForMonth(calendar, year, month),
    [calendar, year, month]
  );

  const calendarInSync = calendar?.year === year && calendar?.month === month;

  const slots = useMemo(() => {
    if (!selectedDay) return [];
    return (slotsByDay[selectedDay] || []).filter((s) => s.available);
  }, [slotsByDay, selectedDay]);

  const scheduleReturn = async (slotId) => {
    setSubmittingId(slotId);
    setError(null);
    try {
      const api =
        mode === 'schedule'
          ? jobsAPI.scheduleReturnVisit(booking.id, { slot_id: slotId, note })
          : jobsAPI.markBookingIncomplete(booking.id, { slot_id: slotId, note });
      const res = await api;
      onDone?.(res.data);
      onClose();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSubmittingId(null);
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

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{booking.service_name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            Close
          </button>
        </div>

        <div className="space-y-4 p-4">
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

          {error && <p className="text-sm text-red-600">{error}</p>}

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
              {calendarFetching ? (
                <p className="text-sm text-slate-500">Loading calendar…</p>
              ) : !calendarInSync ? (
                <p className="text-sm text-red-600">{error || 'Could not load availability.'}</p>
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
                  {selectedDay && (
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {slots.length === 0 ? (
                        <li className="col-span-full text-sm text-slate-500">No open slots this day.</li>
                      ) : (
                        slots.map((slot) => (
                          <li key={slot.id}>
                            <button
                              type="button"
                              disabled={submittingId != null}
                              onClick={() => scheduleReturn(slot.id)}
                              className="w-full min-h-[44px] rounded-lg border border-slate-200 text-sm font-medium text-slate-800 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-60"
                            >
                              {submittingId === slot.id
                                ? 'Booking…'
                                : formatTimeRange(slot.start_at, slot.end_at)}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
