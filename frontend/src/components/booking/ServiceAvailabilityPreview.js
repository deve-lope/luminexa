import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BookingCalendar from './BookingCalendar';
import { businessesAPI } from '../../utils/api';
import { formatTimeRange } from '../../utils/datetime';
import {
  calendarDataForMonth,
  firstBookableDayKey,
  isSlotBookableForCustomer,
  normalizeBookingCalendar,
} from '../../utils/slotCalendar';

function parseApiError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Could not load availability.';
}

/**
 * Read-only (or selectable) open-slot preview for quote-first services.
 */
export default function ServiceAvailabilityPreview({
  orgSlug,
  serviceId,
  compact = false,
  title = 'When they’re available',
  hint = 'Open slots are shown so you can plan ahead. Nothing is reserved until you accept a quote and pick a time.',
  selectable = false,
  selectedSlotId = null,
  onSelectSlot = null,
  className = '',
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [calendar, setCalendar] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const load = useCallback(() => {
    if (!orgSlug || !serviceId) return;
    setFetching(true);
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
      .finally(() => setFetching(false));
  }, [orgSlug, serviceId, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const { days: calendarDays, slots_by_day: slotsByDay } = useMemo(
    () => calendarDataForMonth(calendar, year, month),
    [calendar, year, month]
  );

  const slotsForDay = useMemo(() => {
    if (!selectedDay) return [];
    return (slotsByDay[selectedDay] || []).filter((slot) => isSlotBookableForCustomer(slot));
  }, [selectedDay, slotsByDay]);

  const shiftMonth = (delta) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  if (!orgSlug || !serviceId) return null;

  return (
    <section className={`rounded-xl border border-slate-200 bg-slate-50/80 p-4 ${className}`.trim()}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {hint && <p className="mt-1 text-xs leading-relaxed text-slate-600">{hint}</p>}
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button type="button" onClick={load} className="ml-2 font-medium underline">
            Retry
          </button>
        </p>
      )}
      {fetching && !calendar ? (
        <p className="mt-3 text-sm text-slate-500">Loading calendar…</p>
      ) : (
        <div className="mt-3">
          <BookingCalendar
            year={year}
            month={month}
            days={calendarDays}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            openOnly={!selectable}
            size={compact ? 'compact' : 'full'}
          />
        </div>
      )}
      {selectedDay && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Open times —{' '}
            {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          {slotsForDay.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No open slots this day.</p>
          ) : selectable ? (
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {slotsForDay.map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                return (
                  <li key={slot.id}>
                    <button
                      type="button"
                      onClick={() => onSelectSlot?.(slot)}
                      className={`w-full min-h-[44px] rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
                        isSelected
                          ? 'border-luminexa-accent bg-teal-50 text-teal-900 ring-2 ring-teal-100'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-teal-300'
                      }`}
                    >
                      {formatTimeRange(slot.start_at, slot.end_at)}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {slotsForDay.map((slot) => (
                <li
                  key={slot.id}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900"
                >
                  {formatTimeRange(slot.start_at, slot.end_at)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
