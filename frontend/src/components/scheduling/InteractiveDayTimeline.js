import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { withReturnTo } from '../../utils/navigationBack';
import {
  providerRequestDetail,
  providerSchedule,
  providerScheduleDetail,
} from '../../utils/providerPaths';
import { buildDayTimeline, TIMELINE_COLORS, TIMELINE_LABELS } from '../../utils/dayTimeline';
import { formatMsRange, pickTimelineDisplayMarkers } from '../../utils/timelineInteraction';
import { slotLocalDayKey } from '../../utils/slotCalendar';

function bookingNavPath(seg, orgSlug, dayKey) {
  if (!orgSlug) return null;
  if (seg.type !== 'booked' && seg.type !== 'pending') return null;
  const slot = seg.slot;
  if (!slot?.booking_id) return null;
  const status = (slot.booking_status || '').toLowerCase();
  const path =
    status === 'requested' || status === 'quoted'
      ? providerRequestDetail(orgSlug, 'booking', slot.booking_id)
      : providerScheduleDetail(orgSlug, 'booking', slot.booking_id);
  return withReturnTo(path, providerSchedule(orgSlug, { day: dayKey }));
}

/** Read-only day bar: tap jobs / unavailable for details. No drag-to-draw. */
export default function InteractiveDayTimeline({
  dayKey,
  slots,
  unavailable,
  weeklyBlocks,
  onDeleteUnavailable,
  deletingUnavailableId = null,
}) {
  const { orgSlug } = useProviderOrg();
  const [selection, setSelection] = useState(null);

  const timeline = useMemo(
    () => buildDayTimeline(dayKey, { slots, unavailable, weeklyBlocks }),
    [dayKey, slots, unavailable, weeklyBlocks],
  );
  const { segments, markers: rawMarkers } = timeline;
  const displayMarkers = useMemo(
    () => pickTimelineDisplayMarkers(rawMarkers),
    [rawMarkers],
  );

  useEffect(() => {
    setSelection(null);
  }, [dayKey]);

  const handleSegmentClick = (seg) => {
    if (seg.type === 'off_hours' || seg.type === 'idle') {
      setSelection(null);
      return;
    }
    if (seg.type === 'booked' || seg.type === 'pending') {
      const slot = seg.slot;
      setSelection({
        kind: 'booking',
        startMs: seg.startMs,
        endMs: seg.endMs,
        path: bookingNavPath(seg, orgSlug, dayKey),
        customerName: (slot?.customer_name || '').trim() || 'Customer',
        serviceName: (slot?.service_name || '').trim() || 'Service',
        address: (slot?.service_address || '').trim(),
      });
      return;
    }
    if (seg.type === 'unavailable') {
      setSelection({
        kind: 'unavailable',
        startMs: seg.startMs,
        endMs: seg.endMs,
        note: seg.block?.note || '',
        blockId: seg.block?.id || null,
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

  const dayUnavailable = useMemo(
    () =>
      (unavailable || [])
        .filter((u) => slotLocalDayKey(u.start_at) === dayKey)
        .sort((a, b) => new Date(a.start_at) - new Date(b.start_at)),
    [unavailable, dayKey],
  );

  return (
    <div className="space-y-2">
      <div
        className="relative select-none rounded-lg border-2 border-slate-200 bg-slate-100 shadow-inner"
        style={{ height: '3.25rem' }}
      >
        <div className="absolute inset-0 flex overflow-hidden rounded-[10px]">
          {segments.map((seg, i) => {
            const interactive =
              seg.type === 'open' ||
              seg.type === 'unavailable' ||
              seg.type === 'booked' ||
              seg.type === 'pending';
            return (
              <div
                key={`${seg.startMs}-${i}`}
                style={{ width: `${seg.widthPct}%` }}
                className={`h-full shrink-0 border-r border-white/20 last:border-r-0 ${TIMELINE_COLORS[seg.type]} ${
                  interactive ? 'cursor-pointer' : ''
                }`}
                onClick={() => handleSegmentClick(seg)}
                title={`${TIMELINE_LABELS[seg.type]} · ${formatMsRange(seg.startMs, seg.endMs)}`}
              />
            );
          })}
        </div>
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
        <span className="text-slate-400">Tap a block for details</span>
      </div>

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

      {selection?.kind === 'booking' && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/90 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-violet-950">
                {selection.customerName}
              </p>
              <p className="mt-0.5 truncate text-sm text-violet-900">{selection.serviceName}</p>
              <p className="mt-1 text-xs text-violet-800">
                {formatMsRange(selection.startMs, selection.endMs)}
              </p>
              {selection.address ? (
                <p className="mt-1 line-clamp-2 text-xs text-violet-800/90">{selection.address}</p>
              ) : (
                <p className="mt-1 text-xs text-violet-700/70">
                  Address from customer when they confirm
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="shrink-0 text-xs font-medium text-violet-800 underline"
            >
              Close
            </button>
          </div>
          {selection.path && (
            <Link
              to={selection.path}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-violet-700 text-sm font-semibold text-white active:bg-violet-800"
            >
              Show more
            </Link>
          )}
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
          {selection.blockId && onDeleteUnavailable && (
            <button
              type="button"
              disabled={deletingUnavailableId === selection.blockId}
              onClick={async () => {
                await onDeleteUnavailable(selection.blockId);
                setSelection(null);
              }}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-red-700 ring-1 ring-red-200 active:bg-red-50 disabled:opacity-50"
            >
              {deletingUnavailableId === selection.blockId
                ? 'Removing…'
                : 'Remove block (make available again)'}
            </button>
          )}
        </div>
      )}

      {dayUnavailable.length > 0 && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Unavailable today · {dayUnavailable.length}
          </p>
          <ul className="space-y-2">
            {dayUnavailable.map((block) => (
              <li
                key={block.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {formatMsRange(
                      new Date(block.start_at).getTime(),
                      new Date(block.end_at).getTime(),
                    )}
                  </p>
                  {block.note ? (
                    <p className="mt-0.5 text-xs text-slate-600">{block.note}</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-slate-400">Blocked time</p>
                  )}
                </div>
                {onDeleteUnavailable && (
                  <button
                    type="button"
                    disabled={deletingUnavailableId === block.id}
                    onClick={() => onDeleteUnavailable(block.id)}
                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200 active:bg-red-50 disabled:opacity-50"
                  >
                    {deletingUnavailableId === block.id ? '…' : 'Delete'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
