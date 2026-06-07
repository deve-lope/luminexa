import React, { useMemo, useState } from 'react';
import { ADD_MODE_META, formatMsRange } from '../../utils/timelineInteraction';

const MODES = ['open', 'unavailable', 'book'];

export default function ScheduleAddSheet({
  activeMode,
  onSelectMode,
  onCancelMode,
  draftRange,
  services = [],
  serviceId,
  onServiceChange,
  customers = [],
  onConfirm,
  submitting,
  error,
}) {
  const [customerQuery, setCustomerQuery] = useState('');
  const [pickedCustomer, setPickedCustomer] = useState(null);
  const [note, setNote] = useState('');
  const [bookNotes, setBookNotes] = useState('');

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const list = customers || [];
    if (!q) return list.slice(0, 6);
    return list
      .filter(
        (c) =>
          c.full_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [customers, customerQuery]);

  const timeLabel = draftRange ? formatMsRange(draftRange.startMs, draftRange.endMs) : '';

  const handleConfirm = () => {
    if (!draftRange || !activeMode) return;
    onConfirm({
      mode: activeMode,
      startMs: draftRange.startMs,
      endMs: draftRange.endMs,
      serviceId: activeMode === 'book' ? Number(serviceId) : undefined,
      customerId: activeMode === 'book' ? pickedCustomer?.id : undefined,
      note: activeMode === 'unavailable' ? note.trim() : '',
      bookNotes: activeMode === 'book' ? bookNotes.trim() : '',
    });
  };

  if (!activeMode) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <p className="text-sm font-semibold text-slate-900">Add to schedule</p>
        <p className="mt-1 text-xs text-slate-500">
          Choose what to add, then drag on the timeline below to set the time range.
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:grid sm:overflow-visible sm:pb-0 sm:grid-cols-3">
          {MODES.map((mode) => {
            const meta = ADD_MODE_META[mode];
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onSelectMode(mode)}
                className={`min-w-[9.5rem] shrink-0 rounded-xl border-2 border-slate-200/80 p-3 text-left transition active:scale-[0.98] hover:border-slate-300 hover:shadow-md sm:min-w-0 ${meta.light}`}
              >
                <span className={`inline-block h-2 w-8 rounded-full ${meta.color}`} />
                <p className={`mt-2 text-sm font-semibold ${meta.text}`}>{meta.label}</p>
                <p className="mt-0.5 text-xs text-slate-600">{meta.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const meta = ADD_MODE_META[activeMode];

  return (
    <div className={`rounded-xl border-2 p-3 shadow-sm sm:p-4 ${meta.light} ${meta.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`text-sm font-semibold ${meta.text}`}>{meta.label}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {draftRange
              ? `Selected: ${timeLabel}`
              : activeMode === 'unavailable'
                ? 'Drag on the timeline or set From/Until times above. Open slots in this range are removed when you save.'
                : 'Drag on the timeline or set From/Until times above (pull edges on the bar to adjust)'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onCancelMode();
            setPickedCustomer(null);
            setCustomerQuery('');
            setNote('');
            setBookNotes('');
          }}
          className="text-sm font-medium text-slate-500 underline"
        >
          Cancel
        </button>
      </div>

      {draftRange && (
        <div className="mt-3 space-y-3">
          {activeMode === 'book' && services.length > 0 && (
            <label className="block text-xs font-medium text-slate-600">
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

          {activeMode === 'unavailable' && (
            <label className="block text-xs font-medium text-slate-600">
              Note (optional)
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Lunch, travel…"
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
          )}

          {activeMode === 'book' && (
            <>
              <div>
                {pickedCustomer ? (
                  <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                    <div>
                      <p className="font-medium text-slate-900">{pickedCustomer.full_name}</p>
                      <p className="text-xs text-slate-500">{pickedCustomer.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPickedCustomer(null)}
                      className="text-xs text-slate-500 underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="search"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder="Search customer…"
                      className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    />
                    {customerQuery.trim() && filteredCustomers.length > 0 && (
                      <ul className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {filteredCustomers.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setPickedCustomer(c);
                                setCustomerQuery('');
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            >
                              <span className="font-medium">{c.full_name}</span>
                              <span className="block text-xs text-slate-500">{c.email}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <label className="block text-xs font-medium text-slate-600">
                Notes (optional)
                <input
                  type="text"
                  value={bookNotes}
                  onChange={(e) => setBookNotes(e.target.value)}
                  className="mt-1 block w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm"
                />
              </label>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            disabled={
              submitting ||
              (activeMode === 'book' && !pickedCustomer) ||
              (activeMode === 'book' && !serviceId)
            }
            onClick={handleConfirm}
            className="w-full min-h-[48px] rounded-xl bg-luminexa-accent font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Saving…' : `Save ${meta.label.toLowerCase()}`}
          </button>
        </div>
      )}
    </div>
  );
}
