import React from 'react';
import { formatTimeRangeCompact } from '../../utils/datetime';
import { isSlotFullyBooked } from '../../utils/slotCalendar';

/**
 * Customer booking time tile.
 * Open = teal border; selected = solid teal; booked = light red.
 */
export default function CustomerSlotTimeButton({
  slot,
  selected = false,
  onSelect,
  onBookedSelect,
  planningOnly = false,
}) {
  // Prefer normalized `available` from the calendar payload.
  const open = slot?.available === true;
  const booked = !open && isSlotFullyBooked(slot);
  const label = formatTimeRangeCompact(slot.start_at, slot.end_at);
  const capacityHint =
    open && Number(slot.capacity) > 1 && Number(slot.remaining_capacity) > 0
      ? `${slot.remaining_capacity} left`
      : null;

  const handleClick = () => {
    if (booked) {
      onBookedSelect?.(slot);
      return;
    }
    if (open) onSelect?.(slot);
  };

  let tone = 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed';
  if (booked) {
    tone = 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100/90';
  } else if (selected && open) {
    tone =
      'border-luminexa-accent bg-luminexa-accent text-white shadow-sm ring-2 ring-teal-200/80';
  } else if (open) {
    tone =
      'border-luminexa-accent bg-white text-teal-900 hover:bg-teal-50 active:bg-teal-100';
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={Boolean(selected && open)}
      aria-disabled={booked || !open}
      title={booked ? 'Slot already booked' : open ? 'Available' : undefined}
      className={`flex w-full min-h-[48px] flex-col items-center justify-center rounded-xl border-2 px-2 py-2.5 text-center transition ${tone}`}
    >
      <span className="whitespace-nowrap text-xs font-semibold tabular-nums tracking-tight sm:text-sm">
        {label}
      </span>
      {booked ? (
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
          Booked
        </span>
      ) : selected && open ? (
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
          {planningOnly ? 'Selected' : 'Selected'}
        </span>
      ) : capacityHint ? (
        <span className="mt-0.5 text-[10px] font-medium text-teal-700">{capacityHint}</span>
      ) : open ? (
        <span className="mt-0.5 text-[10px] font-medium text-teal-700/80">
          {planningOnly ? 'Tap to compare' : 'Open'}
        </span>
      ) : null}
    </button>
  );
}
