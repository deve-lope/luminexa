import React, { useCallback, useEffect, useState } from 'react';
import BookingCalendar from './BookingCalendar';
import { businessesAPI, jobsAPI } from '../../utils/api';
import { formatTimeRange } from '../../utils/datetime';
import parseApiError from '../../utils/parseApiError';

export default function RescheduleBookingModal({
  open,
  onClose,
  booking,
  onRescheduled,
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [calendar, setCalendar] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [error, setError] = useState(null);

  const orgSlug = booking?.organization_slug;
  const serviceId = booking?.service;

  const loadCalendar = useCallback(() => {
    if (!orgSlug || !serviceId) return;
    setLoading(true);
    setError(null);
    businessesAPI
      .getServiceCalendar(orgSlug, serviceId, { year, month })
      .then((res) => {
        setCalendar(res.data);
        const days = res.data?.days || {};
        const firstAvailable = Object.keys(days).find((k) => days[k].status === 'available');
        setSelectedDay((prev) => {
          if (prev && days[prev]?.status === 'available') return prev;
          return firstAvailable || null;
        });
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug, serviceId, year, month]);

  useEffect(() => {
    if (open) loadCalendar();
  }, [open, loadCalendar]);

  const slots = selectedDay && calendar?.days?.[selectedDay]?.slots
    ? calendar.days[selectedDay].slots.filter((s) => s.status === 'open')
    : [];

  const reschedule = async (slotId) => {
    setSubmittingId(slotId);
    setError(null);
    try {
      await jobsAPI.rescheduleBooking(booking.id, slotId);
      onRescheduled?.();
      onClose();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSubmittingId(null);
    }
  };

  if (!open || !booking) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-slate-900">Reschedule appointment</h2>
            <p className="mt-1 text-sm text-slate-600">{booking.service_name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            Close
          </button>
        </div>
        <div className="space-y-4 p-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          {loading && !calendar ? (
            <p className="text-center text-slate-500 py-8">Loading calendar…</p>
          ) : (
            <>
              <BookingCalendar
                year={year}
                month={month}
                days={calendar?.days}
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
              />
              {selectedDay && slots.length === 0 && (
                <p className="text-sm text-slate-500">No open slots this day.</p>
              )}
              <ul className="space-y-2">
                {slots.map((slot) => (
                  <li key={slot.id}>
                    <button
                      type="button"
                      disabled={submittingId != null}
                      onClick={() => reschedule(slot.id)}
                      className="flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-800 disabled:opacity-50"
                    >
                      <span>{formatTimeRange(slot.start_at, slot.end_at)}</span>
                      <span className="text-luminexa-accent">
                        {submittingId === slot.id ? 'Saving…' : 'Select'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
