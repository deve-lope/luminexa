import React, { useMemo } from 'react';
import { defaultDayBounds } from '../../utils/dayTimeline';
import {
  buildDayTimeOptions,
  formatMsRange,
  msToTimeValue,
  normalizeRange,
  timeValueToMs,
  validateDraftRange,
} from '../../utils/timelineInteraction';

/**
 * From / Until dropdowns (15-minute steps). Primary way to set add-mode times —
 * timeline drag is optional.
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
  const options = useMemo(
    () => buildDayTimeOptions(dayKey, weeklyBlocks),
    [dayKey, weeklyBlocks],
  );

  if (!dayKey || !draftRange || !options.length) return null;

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
    const startMs = timeValueToMs(dayKey, timeStr);
    let endMs = draftRange.endMs;
    if (endMs <= startMs) {
      endMs = startMs + 60 * 60 * 1000;
    }
    applyRange(startMs, endMs);
  };

  const updateEnd = (timeStr) => {
    const endMs = timeValueToMs(dayKey, timeStr);
    applyRange(draftRange.startMs, endMs);
  };

  const startValue = msToTimeValue(draftRange.startMs);
  const endValue = msToTimeValue(draftRange.endMs);
  const startOptions = options;
  const endOptions = options.filter((o) => o.ms > draftRange.startMs);

  return (
    <div className="rounded-lg border border-white/80 bg-white/90 p-3 ring-1 ring-slate-200/80">
      <p className="text-xs font-semibold text-slate-800">
        Time · {formatMsRange(draftRange.startMs, draftRange.endMs)}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">Choose From and Until — no need to drag.</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-slate-600">
          From
          <select
            disabled={disabled}
            value={startValue}
            onChange={(e) => updateStart(e.target.value)}
            className="mt-1 w-full min-h-[48px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900"
          >
            {startOptions.map((o) => (
              <option key={`from-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Until
          <select
            disabled={disabled}
            value={endOptions.some((o) => o.value === endValue) ? endValue : endOptions[0]?.value}
            onChange={(e) => updateEnd(e.target.value)}
            className="mt-1 w-full min-h-[48px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900"
          >
            {endOptions.map((o) => (
              <option key={`until-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
