import React, { useState } from 'react';
import { dayTimeToIso } from '../../utils/dayTimeline';

export default function AddOpenSlotPanel({
  selectedDay,
  services,
  serviceId,
  onServiceChange,
  onSubmit,
  submitting,
}) {
  const [fromTime, setFromTime] = useState('09:00');
  const [toTime, setToTime] = useState('10:00');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDay || !serviceId) return;
    onSubmit({
      start_at: dayTimeToIso(selectedDay, fromTime),
      end_at: dayTimeToIso(selectedDay, toTime),
      service: Number(serviceId),
    });
  };

  const dayLabel = selectedDay
    ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : '';

  if (!selectedDay) {
    return (
      <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 px-4 py-5 text-center text-sm text-slate-600">
        Pick a day on the calendar to add open times customers can book.
      </p>
    );
  }

  if (!services?.length) {
    return null;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm"
    >
      <h3 className="text-base font-semibold text-slate-900">Make times available</h3>
      <p className="mt-1 text-sm text-slate-600">
        Set <strong>from</strong> and <strong>to</strong> on {dayLabel}. Customers will see these
        slots when booking.
      </p>

      {services.length > 1 && (
        <label className="mt-3 block text-xs font-medium text-slate-600">
          Service
          <select
            value={serviceId}
            onChange={(e) => onServiceChange(e.target.value)}
            className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">
          From
          <input
            type="time"
            required
            value={fromTime}
            onChange={(e) => setFromTime(e.target.value)}
            className="mt-1 block min-h-[44px] rounded-lg border border-slate-200 bg-white px-3"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          To
          <input
            type="time"
            required
            value={toTime}
            onChange={(e) => setToTime(e.target.value)}
            className="mt-1 block min-h-[44px] rounded-lg border border-slate-200 bg-white px-3"
          />
        </label>
        <button
          type="submit"
          disabled={submitting || !serviceId}
          className="min-h-[44px] rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Adding…' : 'Add open slot'}
        </button>
      </div>
    </form>
  );
}
