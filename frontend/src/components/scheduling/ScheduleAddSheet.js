import React, { useState } from 'react';
import TimelineTimeAdjust from './TimelineTimeAdjust';
import { ADD_MODE_META, formatMsRange } from '../../utils/timelineInteraction';

const MODES = ['open', 'unavailable'];

/**
 * Open slot / unavailable time only. Customer booking uses BookCustomerForm.
 */
export default function ScheduleAddSheet({
  activeMode,
  onSelectMode,
  onCancelMode,
  draftRange,
  onDraftRangeChange,
  onRangeError,
  dayKey,
  weeklyBlocks = [],
  slots = [],
  unavailable = [],
  onConfirm,
  submitting,
  error,
}) {
  const [note, setNote] = useState('');
  const timeLabel = draftRange ? formatMsRange(draftRange.startMs, draftRange.endMs) : '';

  const handleConfirm = () => {
    if (!draftRange || !activeMode) return;
    onConfirm({
      mode: activeMode,
      startMs: draftRange.startMs,
      endMs: draftRange.endMs,
      note: activeMode === 'unavailable' ? note.trim() : '',
    });
  };

  if (!activeMode) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <p className="text-sm font-semibold text-slate-900">Open hours / time off</p>
        <p className="mt-1 text-xs text-slate-500">
          Add an open slot customers can book, or block unavailable time.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {MODES.map((mode) => {
            const meta = ADD_MODE_META[mode];
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onSelectMode(mode)}
                className={`rounded-xl border-2 border-slate-200/80 p-3 text-left transition active:scale-[0.98] hover:border-slate-300 hover:shadow-md ${meta.light}`}
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
            {draftRange ? `Selected: ${timeLabel}` : 'Pick From and Until below.'}
            {activeMode === 'unavailable'
              ? ' Open slots in this range are removed when you save.'
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onCancelMode();
            setNote('');
          }}
          className="text-sm font-medium text-slate-500 underline"
        >
          Cancel
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <TimelineTimeAdjust
          dayKey={dayKey}
          draftRange={draftRange}
          onDraftRangeChange={onDraftRangeChange}
          onRangeError={onRangeError}
          addMode={activeMode}
          slots={slots}
          unavailable={unavailable}
          weeklyBlocks={weeklyBlocks}
          disabled={submitting}
        />

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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          disabled={submitting || !draftRange}
          onClick={handleConfirm}
          className="lx-btn-primary w-full min-h-[48px] disabled:opacity-50"
        >
          {submitting ? 'Saving…' : `Save ${meta.label.toLowerCase()}`}
        </button>
      </div>
    </div>
  );
}
