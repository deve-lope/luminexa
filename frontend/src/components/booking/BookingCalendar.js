import React, { useMemo } from 'react';
import { formatMonthYear } from '../../utils/datetime';
import { formatLocalDateKey, isDateKeyInRange, todayKey } from '../../utils/dateRange';

const WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayCellClass({
  status,
  isSelected,
  isPast,
  isInRange,
  openOnly,
  allowSelectFutureDays,
}) {
  if (isPast) return 'bg-slate-100 text-slate-300 cursor-not-allowed';
  if (isSelected) {
    return 'bg-violet-600 text-white shadow-sm ring-2 ring-inset ring-violet-300';
  }
  if (isInRange) return 'bg-violet-100 text-violet-900 ring-1 ring-violet-200';
  if (status === 'available') {
    return 'bg-emerald-400 text-white active:bg-emerald-600';
  }
  if (openOnly) {
    return 'bg-slate-50 text-slate-400 cursor-not-allowed';
  }
  if (allowSelectFutureDays) {
    return 'border border-slate-200 bg-white text-slate-800 hover:border-violet-400 hover:bg-violet-50 active:bg-violet-100';
  }
  if (status === 'full') return 'bg-red-100 text-red-900 hover:bg-red-200';
  return 'bg-white text-slate-600 hover:bg-slate-50';
}

export default function BookingCalendar({
  year,
  month,
  days,
  selectedDay,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  openOnly = false,
  allowSelectFutureDays = false,
  showLegend = true,
  rangeStart = null,
  rangeEnd = null,
  size = 'full',
}) {
  const today = todayKey();

  const cells = useMemo(() => {
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const result = [];
    for (let i = 0; i < firstDow; i += 1) {
      result.push({ key: `pad-${i}`, pad: true });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = formatLocalDateKey(new Date(year, month - 1, d));
      const cellDate = new Date(year, month - 1, d);
      const isPast = cellDate < todayDate;
      const meta = days?.[key];
      const status = meta?.status || 'none';
      result.push({
        key,
        day: d,
        status,
        isPast,
        pad: false,
        hasOpen: status === 'available',
        isToday: key === today,
      });
    }
    return result;
  }, [year, month, days, today]);

  const shellClass =
    size === 'compact'
      ? 'w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm'
      : 'w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4';

  const weekdayLabels = size === 'compact' ? WEEKDAYS_SHORT : WEEKDAYS_FULL;
  const cellClass =
    size === 'compact'
      ? 'aspect-square w-full min-h-[2.35rem] text-xs sm:min-h-[2.5rem] sm:text-sm'
      : 'aspect-square w-full min-h-[2.5rem] text-sm sm:min-h-[2.75rem]';
  const weekText = size === 'compact' ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm';
  const gridGap = 'gap-1 sm:gap-1.5';

  const selectDay = (cell) => {
    if (cell.isPast) return;
    if (openOnly && !cell.hasOpen) return;
    onSelectDay(cell.key);
  };

  /** Prevent mobile browsers from scrolling the page when month nav steals focus. */
  const keepScrollOnPress = (event) => {
    event.preventDefault();
  };

  return (
    <div className={shellClass}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onMouseDown={keepScrollOnPress}
          onClick={onPrevMonth}
          className={`flex shrink-0 items-center justify-center rounded-lg border border-slate-200 text-lg leading-none text-slate-700 active:bg-slate-50 ${
            size === 'compact' ? 'h-8 w-8' : 'h-9 w-9'
          }`}
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3
          className={`truncate font-semibold text-slate-900 ${
            size === 'compact' ? 'text-xs' : 'text-sm sm:text-base'
          }`}
        >
          {formatMonthYear(year, month)}
        </h3>
        <button
          type="button"
          onMouseDown={keepScrollOnPress}
          onClick={onNextMonth}
          className={`flex shrink-0 items-center justify-center rounded-lg border border-slate-200 text-lg leading-none text-slate-700 active:bg-slate-50 ${
            size === 'compact' ? 'h-8 w-8' : 'h-9 w-9'
          }`}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div
        className={`grid grid-cols-7 text-center font-medium leading-none text-slate-500 ${gridGap} ${weekText}`}
      >
        {weekdayLabels.map((w, i) => (
          <div key={`${w}-${i}`} className="py-1 font-semibold">
            {w}
          </div>
        ))}
      </div>

      <div className={`mt-1 grid grid-cols-7 ${gridGap}`}>
        {cells.map((cell) =>
          cell.pad ? (
            <div key={cell.key} className={cellClass} aria-hidden />
          ) : (
            <button
              key={cell.key}
              type="button"
              onClick={() => selectDay(cell)}
              tabIndex={cell.isPast || (openOnly && !cell.hasOpen) ? -1 : 0}
              aria-pressed={selectedDay === cell.key}
              aria-label={`${cell.day}${cell.isToday ? ', today' : ''}${
                selectedDay === cell.key ? ', selected' : ''
              }${cell.hasOpen ? ', has open slots' : ''}`}
              aria-disabled={cell.isPast || (openOnly && !cell.hasOpen)}
              className={`relative flex touch-manipulation select-none items-center justify-center rounded-lg font-semibold leading-none transition ${cellClass} ${dayCellClass(
                {
                  status: cell.status,
                  isSelected: selectedDay === cell.key,
                  isPast: cell.isPast,
                  isInRange: isDateKeyInRange(cell.key, rangeStart, rangeEnd),
                  openOnly,
                  allowSelectFutureDays,
                }
              )}`}
              title={
                cell.hasOpen
                  ? 'Has open slots for customers'
                  : allowSelectFutureDays
                    ? 'Tap to manage this day'
                    : undefined
              }
            >
              {cell.day}
              {cell.isToday && selectedDay !== cell.key && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-violet-500" />
              )}
            </button>
          )
        )}
      </div>

      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] leading-tight text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-violet-600" />
            Selected day
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
            {openOnly || allowSelectFutureDays ? 'Open slots' : 'Available'}
          </span>
          {allowSelectFutureDays && (
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white" />
              Tap to add times
            </span>
          )}
        </div>
      )}
    </div>
  );
}
