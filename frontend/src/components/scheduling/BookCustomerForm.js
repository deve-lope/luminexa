import React, { useEffect, useMemo, useState } from 'react';
import TimelineTimeAdjust from './TimelineTimeAdjust';

/**
 * Simple staff booking form: time + service + customer name/email.
 * New callers are the default; existing clients are optional.
 */
export default function BookCustomerForm({
  dayKey,
  dayLabel,
  draftRange,
  onDraftRangeChange,
  onRangeError,
  weeklyBlocks = [],
  slots = [],
  unavailable = [],
  services = [],
  serviceId,
  onServiceChange,
  customers = [],
  onSubmit,
  onCancel,
  submitting,
  error,
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [useExisting, setUseExisting] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    // Reset customer fields when the selected day changes.
    setFullName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setUseExisting(false);
    setQuery('');
    setPicked(null);
  }, [dayKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = customers || [];
    if (!q) return list.slice(0, 8);
    return list
      .filter(
        (c) =>
          c.full_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          (c.phone || '').includes(q),
      )
      .slice(0, 8);
  }, [customers, query]);

  const canSubmit = Boolean(
    draftRange &&
      serviceId &&
      (picked ||
        (fullName.trim() && email.trim().includes('@') && email.trim().includes('.'))),
  );

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    onSubmit({
      startMs: draftRange.startMs,
      endMs: draftRange.endMs,
      serviceId: Number(serviceId),
      customerId: picked?.id,
      newCustomer: picked
        ? undefined
        : {
            full_name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
          },
      bookNotes: notes.trim(),
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border-2 border-violet-300 bg-violet-50/80 p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-violet-950">Book for a customer</p>
          <p className="mt-0.5 text-sm text-violet-900/80">
            {dayLabel || 'Pick a day'} · enter their details and time
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-slate-500 underline"
        >
          Cancel
        </button>
      </div>

      <TimelineTimeAdjust
        dayKey={dayKey}
        draftRange={draftRange}
        onDraftRangeChange={onDraftRangeChange}
        onRangeError={onRangeError}
        addMode="book"
        slots={slots}
        unavailable={unavailable}
        weeklyBlocks={weeklyBlocks}
        disabled={submitting}
      />

      {services.length > 0 && (
        <label className="block text-sm font-medium text-slate-800">
          Service
          <select
            value={serviceId}
            onChange={(e) => onServiceChange(e.target.value)}
            className="mt-1 block w-full min-h-[48px] rounded-xl border border-slate-200 bg-white px-3 text-base"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!useExisting ? (
        <div className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-900">Customer</p>
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
              className="mt-1 block w-full min-h-[48px] rounded-xl border border-slate-200 px-3 text-base"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@email.com"
              autoComplete="email"
              inputMode="email"
              className="mt-1 block w-full min-h-[48px] rounded-xl border border-slate-200 px-3 text-base"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Phone <span className="font-normal text-slate-500">(optional)</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="555-0100"
              autoComplete="tel"
              className="mt-1 block w-full min-h-[48px] rounded-xl border border-slate-200 px-3 text-base"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setUseExisting(true);
              setFullName('');
              setEmail('');
              setPhone('');
            }}
            className="text-sm font-medium text-violet-800 underline"
          >
            Or choose an existing client
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Existing client</p>
            <button
              type="button"
              onClick={() => {
                setUseExisting(false);
                setPicked(null);
                setQuery('');
              }}
              className="text-sm font-medium text-violet-800 underline"
            >
              Enter new customer instead
            </button>
          </div>
          {picked ? (
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
              <div>
                <p className="font-medium text-slate-900">{picked.full_name}</p>
                <p className="text-sm text-slate-500">{picked.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-sm text-slate-500 underline"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full min-h-[48px] rounded-xl border border-slate-200 px-3 text-base"
              />
              <ul className="max-h-48 overflow-y-auto rounded-xl border border-slate-200">
                {filtered.map((c) => (
                  <li key={c.id} className="border-b border-slate-100 last:border-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(c);
                        setQuery('');
                      }}
                      className="w-full px-3 py-3 text-left hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">{c.full_name}</span>
                      <span className="block text-sm text-slate-500">{c.email}</span>
                    </button>
                  </li>
                ))}
                {!filtered.length && (
                  <li className="px-3 py-3 text-sm text-slate-500">No matching clients.</li>
                )}
              </ul>
            </>
          )}
        </div>
      )}

      <label className="block text-sm font-medium text-slate-700">
        Notes <span className="font-normal text-slate-500">(optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 block w-full min-h-[48px] rounded-xl border border-slate-200 bg-white px-3 text-base"
        />
      </label>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="lx-btn-primary w-full min-h-[52px] text-base disabled:opacity-50"
      >
        {submitting ? 'Booking…' : 'Book appointment'}
      </button>
      <p className="text-center text-xs text-slate-500">
        You don’t enter the job address here. We email them a link — for mobile jobs they
        add where you should come, then confirm. After that it appears under their Upcoming.
      </p>
    </form>
  );
}
