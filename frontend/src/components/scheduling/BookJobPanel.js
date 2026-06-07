import React, { useMemo, useState } from 'react';
import { formatTime } from '../../utils/datetime';

export default function BookJobPanel({
  selectedDay,
  bookStart,
  bookEnd,
  bookSlot,
  services,
  bookService,
  onServiceChange,
  customers,
  onBook,
  submitting,
}) {
  const [query, setQuery] = useState('');
  const [pickedCustomer, setPickedCustomer] = useState(null);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const hasTime = Boolean(bookSlot || (bookStart && bookEnd));
  const service = services.find((s) => String(s.id) === String(bookService));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = customers || [];
    if (!q) return list.slice(0, 6);
    return list
      .filter(
        (c) =>
          c.full_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          (c.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      )
      .slice(0, 8);
  }, [customers, query]);

  const dayLabel = selectedDay
    ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const timeLabel = bookStart
    ? `${formatTime(new Date(bookStart).toISOString())}${bookEnd ? ` – ${formatTime(new Date(bookEnd).toISOString())}` : ''}`
    : '';

  const submit = (e) => {
    e.preventDefault();
    if (!pickedCustomer || !hasTime) return;
    onBook({
      customerId: pickedCustomer.id,
      notes: notes.trim(),
    });
    setQuery('');
    setPickedCustomer(null);
    setNotes('');
    setShowNotes(false);
  };

  if (!selectedDay) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Pick a day on the calendar to book a job.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-luminexa-accent/30 bg-gradient-to-b from-violet-50/80 to-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Book job</h3>

      {!hasTime ? (
        <p className="mt-2 text-sm text-slate-600">
          Tap a <span className="font-medium text-emerald-700">green</span> open slot on the timeline
          to book a customer into that time.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-800 ring-1 ring-slate-200">
            {dayLabel}
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-800 ring-1 ring-slate-200">
            {timeLabel}
          </span>
          {service && (
            <span className="rounded-full bg-violet-100 px-3 py-1.5 text-sm font-medium text-violet-900">
              {service.name}
            </span>
          )}
        </div>
      )}

      {services.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase text-slate-500">Service</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onServiceChange(String(s.id))}
                className={`shrink-0 min-h-[44px] rounded-full px-4 text-sm font-medium transition ${
                  String(bookService) === String(s.id)
                    ? 'bg-luminexa-accent text-white'
                    : 'bg-white text-slate-700 ring-1 ring-slate-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="customer-search" className="sr-only">
            Search customer
          </label>
          {pickedCustomer ? (
            <div className="flex min-h-[52px] items-center justify-between gap-2 rounded-xl bg-white px-4 ring-2 ring-luminexa-accent">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{pickedCustomer.full_name}</p>
                <p className="truncate text-sm text-slate-500">{pickedCustomer.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPickedCustomer(null);
                  setQuery('');
                }}
                className="shrink-0 text-sm font-medium text-slate-500 underline"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                id="customer-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customer name or email…"
                autoComplete="off"
                className="w-full min-h-[52px] rounded-xl border border-slate-200 bg-white px-4 text-base placeholder:text-slate-400 focus:border-luminexa-accent focus:outline-none focus:ring-2 focus:ring-luminexa-accent/30"
              />
              {query.trim() && filtered.length > 0 && (
                <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {filtered.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPickedCustomer(c);
                          setQuery('');
                        }}
                        className="flex w-full min-h-[52px] flex-col justify-center px-4 py-2 text-left hover:bg-slate-50 active:bg-violet-50"
                      >
                        <span className="font-medium text-slate-900">{c.full_name}</span>
                        <span className="text-sm text-slate-500">{c.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim() && filtered.length === 0 && (
                <p className="mt-2 px-1 text-sm text-slate-500">No customers match. They must be linked to your business first.</p>
              )}
            </>
          )}
        </div>

        {!showNotes ? (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-sm font-medium text-luminexa-accent"
          >
            + Add note for customer
          </button>
        ) : (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        )}

        <button
          type="submit"
          disabled={!hasTime || !pickedCustomer || submitting || !bookService}
          className="w-full min-h-[52px] rounded-xl bg-luminexa-accent text-base font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Booking…' : 'Book job'}
        </button>
      </form>
    </div>
  );
}
