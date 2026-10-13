import React, { useMemo } from 'react';

function addMonths(base, months) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setMonth(d.getMonth() + months);
  return d;
}

function nextMonthDay(monthIndex, day = 1) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let year = today.getFullYear();
  let candidate = new Date(year, monthIndex, day);
  if (candidate <= today) {
    candidate = new Date(year + 1, monthIndex, day);
  }
  return candidate;
}

function toInputDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(y, m - 1, d));
  } catch {
    return iso;
  }
}

const PRESETS = [
  { id: 'm3', label: 'In 3 months', date: () => toInputDate(addMonths(new Date(), 3)) },
  { id: 'm6', label: 'In 6 months', date: () => toInputDate(addMonths(new Date(), 6)) },
  { id: 'm12', label: 'In 12 months', date: () => toInputDate(addMonths(new Date(), 12)) },
  { id: 'apr', label: 'Next Apr 1', date: () => toInputDate(nextMonthDay(3, 1)) },
  { id: 'oct', label: 'Next Oct 1', date: () => toInputDate(nextMonthDay(9, 1)) },
];

/**
 * Optional rebook reminder controls for complete-invoice and post-complete panels.
 */
export default function RebookReminderFields({
  enabled,
  onEnabledChange,
  remindOn,
  onRemindOnChange,
  note,
  onNoteChange,
  minDate,
  showToggle = true,
}) {
  const tomorrow = useMemo(() => {
    if (minDate) return minDate;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toInputDate(d);
  }, [minDate]);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
      {showToggle ? (
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-luminexa-accent"
          />
          <span>
            <span className="font-medium">Remind customer to book again</span>
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              Sends in-app, push, and email on the date you pick (e.g. tires next spring).
            </span>
          </span>
        </label>
      ) : (
        <p className="text-sm font-medium text-slate-800">Remind customer to book again</p>
      )}

      {enabled && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onRemindOnChange(p.date())}
                className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="rebook-remind-on" className="mb-1 block text-xs font-medium text-slate-600">
              Reminder date
            </label>
            <input
              id="rebook-remind-on"
              type="date"
              min={tomorrow}
              value={remindOn}
              onChange={(e) => onRemindOnChange(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
              required={enabled}
            />
            {remindOn ? (
              <p className="mt-1 text-xs text-slate-500">Sends on {formatDisplayDate(remindOn)}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="rebook-note" className="mb-1 block text-xs font-medium text-slate-600">
              Note for customer (optional)
            </label>
            <input
              id="rebook-note"
              type="text"
              maxLength={200}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="e.g. Winter tires next spring"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
          </div>
        </>
      )}
    </div>
  );
}

export { formatDisplayDate, toInputDate, PRESETS };
