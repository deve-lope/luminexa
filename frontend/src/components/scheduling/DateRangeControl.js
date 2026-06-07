import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  addDaysToKey,
  compareDateKeys,
  daysBetweenKeys,
  formatLocalDateKey,
  parseLocalDateKey,
  todayKey,
} from '../../utils/dateRange';

function formatLabel(key) {
  const d = parseLocalDateKey(key);
  if (!d) return key;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Dual-thumb slider + date inputs for selecting a from/until range.
 */
export default function DateRangeControl({
  from,
  until,
  onChange,
  minDaysAhead = 0,
  maxSpanDays = 365,
}) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(null);

  const minKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + minDaysAhead);
    return formatLocalDateKey(d);
  }, [minDaysAhead]);

  const maxKey = useMemo(() => addDaysToKey(minKey, maxSpanDays), [minKey, maxSpanDays]);

  const spanDays = daysBetweenKeys(minKey, maxKey) || 1;
  const fromOffset = Math.max(0, daysBetweenKeys(minKey, from || minKey));
  const untilOffset = Math.max(fromOffset, daysBetweenKeys(minKey, until || from || minKey));

  const fromPct = (fromOffset / spanDays) * 100;
  const untilPct = (untilOffset / spanDays) * 100;

  const offsetToKey = useCallback(
    (offset) => {
      const clamped = Math.max(0, Math.min(spanDays, offset));
      return addDaysToKey(minKey, clamped);
    },
    [minKey, spanDays]
  );

  const pointerToOffset = useCallback(
    (clientX) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect?.width) return 0;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(pct * spanDays);
    },
    [spanDays]
  );

  const applyDrag = useCallback(
    (clientX, thumb) => {
      const offset = pointerToOffset(clientX);
      if (thumb === 'from') {
        const newFrom = offsetToKey(offset);
        const newUntil = compareDateKeys(until, newFrom) < 0 ? newFrom : until;
        onChange({ from: newFrom, until: newUntil });
      } else {
        const newUntil = offsetToKey(Math.max(offset, fromOffset));
        onChange({ from, until: newUntil });
      }
    },
    [from, fromOffset, offsetToKey, onChange, pointerToOffset, until]
  );

  React.useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e) => {
      const x = e.touches?.[0]?.clientX ?? e.clientX;
      applyDrag(x, dragging);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, applyDrag]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          From
          <input
            type="date"
            value={from}
            min={minKey}
            max={until || maxKey}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const end = compareDateKeys(until, v) < 0 ? v : until;
              onChange({ from: v, until: end });
            }}
            className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 px-3"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          To
          <input
            type="date"
            value={until}
            min={from || minKey}
            max={maxKey}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              onChange({ from, until: v });
            }}
            className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 px-3"
          />
        </label>
      </div>

      <div>
        <p className="mb-2 text-xs text-slate-500">
          Slide the handles to set your date range ({formatLabel(from)} → {formatLabel(until)})
        </p>
        <div
          ref={trackRef}
          className="relative mx-2 h-12 touch-none select-none rounded-full bg-slate-200"
          role="group"
          aria-label="Date range slider"
        >
          <div
            className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-violet-300"
            style={{ left: `${fromPct}%`, width: `${Math.max(untilPct - fromPct, 1)}%` }}
          />
          <button
            type="button"
            aria-label="From date"
            className="absolute top-1/2 z-10 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-luminexa-accent shadow-md"
            style={{ left: `${fromPct}%` }}
            onMouseDown={() => setDragging('from')}
            onTouchStart={(e) => {
              e.preventDefault();
              setDragging('from');
            }}
          />
          <button
            type="button"
            aria-label="To date"
            className="absolute top-1/2 z-10 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-700 shadow-md"
            style={{ left: `${untilPct}%` }}
            onMouseDown={() => setDragging('until')}
            onTouchStart={(e) => {
              e.preventDefault();
              setDragging('until');
            }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-400">
          <span>{formatLabel(minKey)}</span>
          <span>{formatLabel(maxKey)}</span>
        </div>
      </div>
    </div>
  );
}

export { todayKey };
