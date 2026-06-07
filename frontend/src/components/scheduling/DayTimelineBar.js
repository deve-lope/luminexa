import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { providerScheduleDetail } from '../../utils/providerPaths';
import {
  buildDayTimeline,
  dayTimeToIso,
  TIMELINE_COLORS,
  TIMELINE_LABELS,
} from '../../utils/dayTimeline';
import { formatTime } from '../../utils/datetime';

function segmentDetailPath(seg, orgSlug) {
  if (!orgSlug) return null;
  if (seg.type === 'unavailable' && seg.block?.id) {
    return providerScheduleDetail(orgSlug, 'block', seg.block.id);
  }
  if (!seg.slot?.id) return null;
  if (seg.slot.booking_id && (seg.type === 'booked' || seg.type === 'pending')) {
    return providerScheduleDetail(orgSlug, 'booking', seg.slot.booking_id);
  }
  if (seg.type === 'open' || seg.type === 'booked' || seg.type === 'pending') {
    return providerScheduleDetail(orgSlug, 'slot', seg.slot.id);
  }
  return null;
}

function segmentHoverText(seg) {
  const time = `${formatTime(new Date(seg.startMs).toISOString())} – ${formatTime(new Date(seg.endMs).toISOString())}`;
  const slot = seg.slot;
  if (seg.type === 'unavailable' && seg.block) {
    return [TIMELINE_LABELS.unavailable, time, seg.block.note].filter(Boolean).join(' · ');
  }
  if (slot?.customer_name) {
    const parts = [slot.customer_name, slot.service_name, time];
    if (slot.service_address) parts.push(slot.service_address);
    return parts.join(' · ');
  }
  if (slot?.service_name) {
    return `${slot.service_name} · ${time}`;
  }
  if (seg.type === 'open') {
    return `${TIMELINE_LABELS.open} · ${time}`;
  }
  return `${TIMELINE_LABELS[seg.type]} · ${time}`;
}

export default function DayTimelineBar({
  dayKey,
  slots,
  unavailable,
  weeklyBlocks,
  selectedSlotId,
  onSelectSlot,
  onRemoveSlot,
  onRemoveUnavailable,
  onAddUnavailable,
  onAddOpenSlot,
  onCreateOpenSlot,
  onSelectTimeRange,
  canEditSlots = true,
  bookSelectionMode = false,
}) {
  const navigate = useNavigate();
  const { orgSlug } = useProviderOrg();
  const [blockStart, setBlockStart] = useState('09:00');
  const [blockEnd, setBlockEnd] = useState('10:00');
  const [blockNote, setBlockNote] = useState('');
  const [addingBlock, setAddingBlock] = useState(false);
  const [hoverSeg, setHoverSeg] = useState(null);

  const timeline = useMemo(
    () => buildDayTimeline(dayKey, { slots, unavailable, weeklyBlocks }),
    [dayKey, slots, unavailable, weeklyBlocks]
  );

  const { segments, markers } = timeline;

  const submitBlock = async (e) => {
    e.preventDefault();
    if (!onAddUnavailable) return;
    setAddingBlock(true);
    try {
      await onAddUnavailable({
        start_at: dayTimeToIso(dayKey, blockStart),
        end_at: dayTimeToIso(dayKey, blockEnd),
        note: blockNote,
      });
      setBlockNote('');
    } finally {
      setAddingBlock(false);
    }
  };

  const handleSegmentClick = (seg) => {
    if (bookSelectionMode) {
      if (seg.type === 'open' && seg.slot && onSelectSlot) {
        onSelectSlot(seg.slot);
        return;
      }
      if (seg.type === 'idle' || seg.type === 'off_hours') {
        if (onCreateOpenSlot) {
          onCreateOpenSlot({
            start: new Date(seg.startMs).toISOString(),
            end: new Date(seg.endMs).toISOString(),
          });
          return;
        }
        if (onSelectTimeRange) {
          onSelectTimeRange({
            start: new Date(seg.startMs).toISOString(),
            end: new Date(seg.endMs).toISOString(),
          });
          return;
        }
      }
      const path = segmentDetailPath(seg, orgSlug);
      if (path && (seg.type === 'booked' || seg.type === 'pending' || seg.type === 'unavailable')) {
        navigate(path);
      }
      return;
    }
    const path = segmentDetailPath(seg, orgSlug);
    if (path) {
      navigate(path);
      return;
    }
    if (seg.type === 'open' && seg.slot && onSelectSlot) {
      onSelectSlot(seg.slot);
    } else if (seg.type === 'idle' && onAddOpenSlot) {
      onAddOpenSlot({
        start: new Date(seg.startMs).toISOString(),
        end: new Date(seg.endMs).toISOString(),
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          className="flex h-12 w-full overflow-hidden rounded-lg border border-slate-200 shadow-inner"
          role="img"
          aria-label="Day schedule timeline"
        >
          {segments.map((seg, i) => {
            const path = segmentDetailPath(seg, orgSlug);
            const clickable =
              Boolean(path) ||
              (seg.type === 'open' && seg.slot) ||
              (seg.type === 'idle' &&
                (onCreateOpenSlot || onSelectTimeRange || (canEditSlots && onAddOpenSlot))) ||
              (bookSelectionMode && seg.type === 'booked' && path);
            const selected = seg.slot && String(seg.slot.id) === String(selectedSlotId);
            return (
              <button
                key={`${seg.startMs}-${i}`}
                type="button"
                disabled={!clickable}
                title={segmentHoverText(seg)}
                onMouseEnter={() => setHoverSeg(seg)}
                onMouseLeave={() => setHoverSeg(null)}
                onClick={() => handleSegmentClick(seg)}
                style={{ width: `${seg.widthPct}%` }}
                className={`relative min-w-0 shrink-0 border-r border-white/20 last:border-r-0 transition ${TIMELINE_COLORS[seg.type]} ${
                  clickable ? 'cursor-pointer' : 'cursor-default'
                } ${selected ? 'ring-2 ring-inset ring-luminexa-accent z-10' : ''}`}
              />
            );
          })}
        </div>
        <div className="relative mt-1 h-5">
          {markers
            .filter((_, i) => i === 0 || i === markers.length - 1 || i % 2 === 0)
            .map((m) => (
              <span
                key={m.ms}
                className="absolute -translate-x-1/2 text-[10px] text-slate-500"
                style={{ left: `${m.leftPct}%` }}
              >
                {m.label}
              </span>
            ))}
        </div>
        {hoverSeg && segmentDetailPath(hoverSeg, orgSlug) && (
          <div
            className="pointer-events-none absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg"
            role="tooltip"
          >
            <p className="font-medium text-slate-900">{segmentHoverText(hoverSeg)}</p>
            <p className="mt-1 text-luminexa-accent">Click for full details →</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {Object.entries(TIMELINE_LABELS).map(([type, label]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-4 rounded-sm ${TIMELINE_COLORS[type].split(' ')[0]}`} />
            {label}
          </span>
        ))}
        <span className="text-slate-400">
          · Gray = add open slot · Green = book customer
        </span>
      </div>

      {selectedSlotId && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-700">
            Selected:{' '}
            {formatTime(
              new Date(
                segments.find((s) => s.slot?.id === selectedSlotId)?.startMs || 0
              ).toISOString()
            )}
          </span>
          {canEditSlots && onRemoveSlot && (
            <button
              type="button"
              onClick={() => onRemoveSlot(selectedSlotId)}
              className="text-red-600 underline"
            >
              Remove slot
            </button>
          )}
        </div>
      )}

      {onAddUnavailable && (
        <form onSubmit={submitBlock} className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-medium text-slate-800">Block unavailable time</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-600">
              From
              <input
                type="time"
                required
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="mt-0.5 block min-h-[40px] rounded-lg border border-slate-200 px-2"
              />
            </label>
            <label className="text-xs text-slate-600">
              To
              <input
                type="time"
                required
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="mt-0.5 block min-h-[40px] rounded-lg border border-slate-200 px-2"
              />
            </label>
            <label className="min-w-[120px] flex-1 text-xs text-slate-600">
              Note (optional)
              <input
                type="text"
                value={blockNote}
                onChange={(e) => setBlockNote(e.target.value)}
                placeholder="Lunch, travel…"
                className="mt-0.5 block w-full min-h-[40px] rounded-lg border border-slate-200 px-2"
              />
            </label>
            <button
              type="submit"
              disabled={addingBlock}
              className="min-h-[40px] rounded-lg bg-slate-700 px-4 text-sm font-medium text-white"
            >
              {addingBlock ? '…' : 'Block time'}
            </button>
          </div>
        </form>
      )}

      {unavailable?.filter((u) => u.start_at.startsWith(dayKey)).length > 0 && (
        <ul className="space-y-1 text-sm text-slate-600">
          {unavailable
            .filter((u) => u.start_at.startsWith(dayKey))
            .map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    orgSlug && navigate(providerScheduleDetail(orgSlug, 'block', u.id))
                  }
                  className="text-left hover:text-luminexa-accent"
                >
                  {formatTime(u.start_at)} – {formatTime(u.end_at)}
                  {u.note ? ` · ${u.note}` : ''}
                </button>
                {onRemoveUnavailable && (
                  <button
                    type="button"
                    onClick={() => onRemoveUnavailable(u.id)}
                    className="text-xs text-red-600 underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
