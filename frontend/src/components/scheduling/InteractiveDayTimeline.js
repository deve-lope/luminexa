import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { providerRequestDetail, providerScheduleDetail } from '../../utils/providerPaths';
import { buildDayTimeline, TIMELINE_COLORS, TIMELINE_LABELS } from '../../utils/dayTimeline';
import {
  ADD_MODE_META,
  eventClientX,
  formatMsRange,
  msToPercent,
  normalizeRange,
  pointerToMs,
  pickTimelineDisplayMarkers,
  validateDraftRange,
} from '../../utils/timelineInteraction';
import { formatTime } from '../../utils/datetime';

function bookingNavPath(seg, orgSlug) {
  if (!orgSlug) return null;
  if (seg.type !== 'booked' && seg.type !== 'pending') return null;
  const slot = seg.slot;
  if (!slot?.booking_id) return null;
  // Confirmed / in-progress style jobs → schedule booking detail ("jobs" view).
  // Quote / request-style pending → requests detail when status suggests it.
  const status = (slot.booking_status || '').toLowerCase();
  if (status === 'requested' || status === 'quoted') {
    return providerRequestDetail(orgSlug, 'booking', slot.booking_id);
  }
  return providerScheduleDetail(orgSlug, 'booking', slot.booking_id);
}

export default function InteractiveDayTimeline({
  dayKey,
  slots,
  unavailable,
  weeklyBlocks,
  addMode,
  draftRange,
  onDraftRangeChange,
  onClearDraft,
}) {
  const navigate = useNavigate();
  const { orgSlug } = useProviderOrg();
  const trackRef = useRef(null);
  const [hoverMs, setHoverMs] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [rangeError, setRangeError] = useState(null);
  const [selection, setSelection] = useState(null);
  const dragAnchorRef = useRef(null);
  const resizeEdgeRef = useRef(null);

  const timeline = useMemo(
    () => buildDayTimeline(dayKey, { slots, unavailable, weeklyBlocks }),
    [dayKey, slots, unavailable, weeklyBlocks]
  );
  const { segments, bounds, markers: rawMarkers } = timeline;
  const displayMarkers = useMemo(
    () => pickTimelineDisplayMarkers(rawMarkers),
    [rawMarkers]
  );
  const { startMs: boundStart, endMs: boundEnd } = bounds;

  const modeMeta = addMode ? ADD_MODE_META[addMode] : null;

  useEffect(() => {
    setSelection(null);
  }, [dayKey]);

  const updateFromPointer = useCallback(
    (clientX, anchorMs, edge) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      let pointerMs = pointerToMs(clientX, rect, boundStart, boundEnd);
      let start = anchorMs;
      let end = pointerMs;
      if (edge === 'start') {
        start = pointerMs;
        end = draftRange?.endMs ?? anchorMs;
      } else if (edge === 'end') {
        start = draftRange?.startMs ?? anchorMs;
        end = pointerMs;
      }
      const normalized = normalizeRange(start, end, bounds);
      if (!normalized) return;
      const err = validateDraftRange(normalized.startMs, normalized.endMs, {
        addMode,
        slots,
        unavailable,
      });
      if (err) {
        setRangeError(err);
        return;
      }
      setRangeError(null);
      onDraftRangeChange(normalized);
    },
    [addMode, boundStart, boundEnd, bounds, draftRange, onDraftRangeChange, slots, unavailable]
  );

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e) => {
      if (e.cancelable) e.preventDefault();
      updateFromPointer(eventClientX(e), dragAnchorRef.current, resizeEdgeRef.current);
    };
    const onUp = () => {
      setDragging(false);
      resizeEdgeRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
  }, [dragging, updateFromPointer]);

  const handleTrackPointerDown = (e) => {
    if (!addMode) return;
    if (e.type === 'touchstart') e.preventDefault();
    if (e.type === 'mousedown' && e.button !== 0) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ms = pointerToMs(eventClientX(e), rect, boundStart, boundEnd);
    dragAnchorRef.current = ms;
    resizeEdgeRef.current = null;
    setDragging(true);
    const normalized = normalizeRange(ms, ms + 60 * 60 * 1000, bounds);
    if (!normalized) return;
    const err = validateDraftRange(normalized.startMs, normalized.endMs, {
      addMode,
      slots,
      unavailable,
    });
    if (err) {
      setRangeError(err);
      return;
    }
    setRangeError(null);
    onDraftRangeChange(normalized);
  };

  const handleResizePointerDown = (e, edge) => {
    if (!addMode || !draftRange) return;
    e.stopPropagation();
    if (e.type === 'touchstart') e.preventDefault();
    dragAnchorRef.current = edge === 'start' ? draftRange.endMs : draftRange.startMs;
    resizeEdgeRef.current = edge;
    setDragging(true);
  };

  const handleTrackPointerMove = (e) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverMs(pointerToMs(eventClientX(e), rect, boundStart, boundEnd));
  };

  const handleSegmentClick = (seg) => {
    if (addMode) return;
    if (seg.type === 'off_hours' || seg.type === 'idle') {
      setSelection(null);
      return;
    }
    if (seg.type === 'booked' || seg.type === 'pending') {
      const path = bookingNavPath(seg, orgSlug);
      if (path) {
        setSelection(null);
        navigate(path);
      }
      return;
    }
    if (seg.type === 'unavailable') {
      setSelection({
        kind: 'unavailable',
        startMs: seg.startMs,
        endMs: seg.endMs,
        note: seg.block?.note || '',
      });
      return;
    }
    if (seg.type === 'open') {
      setSelection({
        kind: 'open',
        startMs: seg.startMs,
        endMs: seg.endMs,
      });
    }
  };

  const draftLeft = draftRange ? msToPercent(draftRange.startMs, boundStart, boundEnd) : 0;
  const draftWidth = draftRange
    ? msToPercent(draftRange.endMs, boundStart, boundEnd) - draftLeft
    : 0;
  const hoverLeft = hoverMs != null ? msToPercent(hoverMs, boundStart, boundEnd) : null;

  const tooltipMs = dragging && draftRange
    ? draftRange.endMs
    : hoverMs;
  const tooltipLeft = dragging && draftRange
    ? draftLeft + draftWidth / 2
    : hoverLeft;

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        className={`relative touch-none select-none rounded-lg border-2 bg-slate-100 shadow-inner transition ${
          addMode ? 'cursor-crosshair border-luminexa-accent/50' : 'border-slate-200'
        }`}
        style={{ height: '3.25rem' }}
        onMouseDown={handleTrackPointerDown}
        onMouseMove={handleTrackPointerMove}
        onTouchStart={handleTrackPointerDown}
        onTouchMove={handleTrackPointerMove}
        onMouseLeave={() => {
          if (!dragging) setHoverMs(null);
        }}
      >
        <div className="absolute inset-0 flex overflow-hidden rounded-[10px]">
          {segments.map((seg, i) => {
            const interactive =
              !addMode &&
              (seg.type === 'open' ||
                seg.type === 'unavailable' ||
                seg.type === 'booked' ||
                seg.type === 'pending');
            return (
              <div
                key={`${seg.startMs}-${i}`}
                style={{ width: `${seg.widthPct}%` }}
                className={`h-full shrink-0 border-r border-white/20 last:border-r-0 ${TIMELINE_COLORS[seg.type]} ${
                  addMode ? 'pointer-events-none' : interactive ? 'cursor-pointer' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSegmentClick(seg);
                }}
                onMouseEnter={() => {
                  if (!addMode) setHoverMs((seg.startMs + seg.endMs) / 2);
                }}
                title={
                  !addMode
                    ? `${TIMELINE_LABELS[seg.type]} · ${formatMsRange(seg.startMs, seg.endMs)}`
                    : undefined
                }
              />
            );
          })}
        </div>

        {draftRange && modeMeta && (
          <div
            className={`absolute top-1 bottom-1 z-20 rounded-md border-2 shadow-lg ${modeMeta.color} ${modeMeta.border} opacity-90`}
            style={{ left: `${draftLeft}%`, width: `${Math.max(draftWidth, 1.5)}%` }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Adjust start time"
              className={`absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize rounded-l-md sm:w-2 ${modeMeta.ring} opacity-80 hover:opacity-100`}
              onMouseDown={(e) => handleResizePointerDown(e, 'start')}
              onTouchStart={(e) => handleResizePointerDown(e, 'start')}
            />
            <button
              type="button"
              aria-label="Adjust end time"
              className={`absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize rounded-r-md sm:w-2 ${modeMeta.ring} opacity-80 hover:opacity-100`}
              onMouseDown={(e) => handleResizePointerDown(e, 'end')}
              onTouchStart={(e) => handleResizePointerDown(e, 'end')}
            />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center truncate px-2 text-[10px] font-bold text-white drop-shadow">
              {formatMsRange(draftRange.startMs, draftRange.endMs)}
            </span>
          </div>
        )}

        {tooltipMs != null && tooltipLeft != null && (
          <div
            className="pointer-events-none absolute top-0 z-30 -translate-x-1/2 -translate-y-full pb-1"
            style={{ left: `${tooltipLeft}%` }}
          >
            <span className="whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg">
              {dragging && draftRange
                ? formatMsRange(draftRange.startMs, draftRange.endMs)
                : formatTime(new Date(tooltipMs).toISOString())}
            </span>
          </div>
        )}

        {hoverMs != null && !dragging && addMode && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-luminexa-accent"
            style={{ left: `${hoverLeft}%` }}
          />
        )}
      </div>

      <div className="relative mt-0.5 h-4 overflow-hidden">
        {displayMarkers.map((m) => (
          <span
            key={m.ms}
            className={`absolute top-0 whitespace-nowrap text-[9px] font-medium leading-none text-slate-500 sm:text-[10px] ${
              m.align === 'start'
                ? 'left-0 text-left'
                : m.align === 'end'
                  ? 'right-0 text-right'
                  : '-translate-x-1/2'
            }`}
            style={m.align === 'middle' ? { left: `${m.leftPct}%` } : undefined}
          >
            {m.label}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 text-[10px] text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 sm:text-xs">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 sm:gap-x-3 sm:gap-y-1">
          {Object.entries(TIMELINE_LABELS).map(([type, label]) => (
            <span key={type} className="flex items-center gap-1">
              <span className={`h-2 w-3 rounded-sm ${TIMELINE_COLORS[type].split(' ')[0]}`} />
              {label}
            </span>
          ))}
        </div>
        {addMode ? (
          <span className="font-medium text-luminexa-accent">
            Drag to draw · pull edges to resize
          </span>
        ) : (
          <span className="text-slate-400">Tap a colored block for details</span>
        )}
      </div>

      {rangeError && addMode && (
        <p className="text-xs text-amber-700">{rangeError}</p>
      )}
      {draftRange && addMode && (
        <button
          type="button"
          onClick={() => {
            setRangeError(null);
            onClearDraft();
          }}
          className="text-xs font-medium text-slate-500 underline"
        >
          Clear selection on timeline
        </button>
      )}

      {selection?.kind === 'open' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-emerald-950">Slots open</p>
              <p className="mt-1 text-sm text-emerald-900">
                {formatMsRange(selection.startMs, selection.endMs)}
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                Customers can book this time from your public page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="text-xs font-medium text-emerald-800 underline"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {selection?.kind === 'unavailable' && (
        <div className="rounded-xl border border-slate-300 bg-slate-100 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Unavailable</p>
              <p className="mt-1 text-sm text-slate-700">
                {formatMsRange(selection.startMs, selection.endMs)}
              </p>
              {selection.note ? (
                <p className="mt-1 text-xs text-slate-600">{selection.note}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-600">This time is blocked for bookings.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="text-xs font-medium text-slate-600 underline"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
