import React from 'react';
import { defaultDayBounds } from '../../utils/dayTimeline';
import { formatMsRange, normalizeRange, validateDraftRange } from '../../utils/timelineInteraction';

function msToTimeInput(ms) {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function timeInputToMs(dayKey, timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(`${dayKey}T00:00:00`);
  d.setHours(h, m || 0, 0, 0);
  return d.getTime();
}

/**
 * Manual from/until time inputs that sync with timeline draft range.
 */
export default function TimelineTimeAdjust({
  dayKey,
  draftRange,
  onDraftRangeChange,
  onRangeError,
  disabled,
  addMode,
  slots,
  unavailable,
  weeklyBlocks,
}) {
  if (!draftRange || !dayKey) return null;

  const applyRange = (startMs, endMs) => {
    const bounds = defaultDayBounds(dayKey, weeklyBlocks);
    const normalized = normalizeRange(startMs, endMs, bounds);
    if (!normalized) {
      onRangeError?.('Time range must fit within working hours for this day.');
      return;
    }
    const err = validateDraftRange(normalized.startMs, normalized.endMs, {
      addMode,
      slots,
      unavailable,
    });
    if (err) {
      onRangeError?.(err);
      return;
    }
    onRangeError?.(null);
    onDraftRangeChange(normalized);
  };

  const updateStart = (timeStr) => {
    const startMs = timeInputToMs(dayKey, timeStr);
    applyRange(startMs, draftRange.endMs);
  };

  const updateEnd = (timeStr) => {
    const endMs = timeInputToMs(dayKey, timeStr);
    applyRange(draftRange.startMs, endMs);
  };

  return (
    <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-3">
      <p className="text-xs font-medium text-violet-900">
        Time: {formatMsRange(draftRange.startMs, draftRange.endMs)}
      </p>
      <p className="mt-0.5 text-[11px] text-violet-700">
        Drag on the bar below, or set times here.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-slate-600">
          From
          <input
            type="time"
            disabled={disabled}
            value={msToTimeInput(draftRange.startMs)}
            onChange={(e) => updateStart(e.target.value)}
            className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Until
          <input
            type="time"
            disabled={disabled}
            value={msToTimeInput(draftRange.endMs)}
            onChange={(e) => updateEnd(e.target.value)}
            className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm"
          />
        </label>
      </div>
    </div>
  );
}
