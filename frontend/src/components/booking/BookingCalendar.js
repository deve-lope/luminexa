import React, { useMemo } from 'react';
import { formatMonthYear } from '../../utils/datetime';
import { formatLocalDateKey, isDateKeyInRange, todayKey } from '../../utils/dateRange';

const WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function busyCellClass(busyLevel) {
  if (busyLevel === 'light') {
    return 'bg-violet-100 text-violet-900 ring-1 ring-inset ring-violet-200 active:bg-violet-200';
  }
  if (busyLevel === 'medium') {
    return 'bg-violet-300 text-violet-950 ring-1 ring-inset ring-violet-400 active:bg-violet-400';
  }
  if (busyLevel === 'heavy') {
    // Darker than selected (violet-600 + ring) so 4+ days don’t look “selected”.
    return 'bg-violet-900 text-white shadow-sm active:bg-violet-950';
  }
  return null;
}

function dayCellClass({
  status,
  busyLevel,
  showWorkLoad,
  isSelected,
  isPast,
  isInRange,
  openOnly,
  allowSelectFutureDays,
  allowFullDays,
}) {
  if (isPast) return 'bg-slate-100 text-slate-300 cursor-not-allowed';
  if (isSelected) {
    return 'bg-violet-600 text-white shadow-sm ring-2 ring-inset ring-violet-300';
  }
  if (isInRange) return 'bg-violet-100 text-violet-900 ring-1 ring-violet-200';

  if (showWorkLoad) {
    const busy = busyCellClass(busyLevel);
    if (busy) return busy;
  }

  if (status === 'available') {
    return 'bg-luminexa-accent text-white active:bg-luminexa-accent-dark';
  }
  if (openOnly && !(allowFullDays && status === 'full')) {
    return 'bg-slate-50 text-slate-400 cursor-not-allowed';
  }
  if (allowSelectFutureDays) {
    return 'border border-slate-200 bg-white text-slate-800 hover:border-violet-400 hover:bg-violet-50 active:bg-violet-100';
  }
  if (status === 'full') return 'bg-red-100 text-red-900 hover:bg-red-200';
  return 'bg-white text-slate-600 hover:bg-slate-50';
}

function workCountLabel(count) {
  if (!count || count < 1) return null;
  if (count > 9) return '9+';
  return String(count);
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
  allowFullDays = false,
  allowSelectFutureDays = false,
  showLegend = true,
  showWorkLoad = false,
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
      const workCount = Number(meta?.work_count) || 0;
      const busyLevel = meta?.busy_level || 'none';
      const openCount = Number(meta?.open_count) || 0;
      result.push({
        key,
        day: d,
        status,
        workCount,
        busyLevel,
        openCount,
        isPast,
        pad: false,
        hasOpen: status === 'available' || openCount > 0,
        isFull: status === 'full',
        hasWork: showWorkLoad && workCount > 0,
        isToday: key === today,
      });
    }
    return result;
  }, [year, month, days, today, showWorkLoad]);

  const shellClass =
    size === 'compact'
      ? 'w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm'
      : 'w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4';

  const weekdayLabels = size === 'compact' ? WEEKDAYS_SHORT : WEEKDAYS_FULL;
  // Fixed row heights (not aspect-square) so wide laptop columns stay short and full-width.
  const cellClass =
    size === 'compact'
      ? 'h-9 w-full text-xs sm:h-10 sm:text-sm'
      : 'h-10 w-full text-sm sm:h-11 lg:h-12';
  const weekText = size === 'compact' ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm';
  const gridGap = size === 'compact' ? 'gap-0.5 sm:gap-1' : 'gap-1 sm:gap-1.5';

  const daySelectable = (cell) => {
    if (cell.isPast) return false;
    if (!openOnly) return true;
    if (cell.hasOpen) return true;
    if (allowFullDays && cell.isFull) return true;
    return false;
  };

  const selectDay = (cell) => {
    if (!daySelectable(cell)) return;
    onSelectDay(cell.key);
  };

  /** Prevent mobile browsers from scrolling the page when month nav steals focus. */
  const keepScrollOnPress = (event) => {
    event.preventDefault();
  };

  return (
    <div className={`${shellClass} [overflow-anchor:none]`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onMouseDown={keepScrollOnPress}
          onTouchStart={keepScrollOnPress}
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
          onTouchStart={keepScrollOnPress}
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
              tabIndex={daySelectable(cell) ? 0 : -1}
              aria-pressed={selectedDay === cell.key}
              aria-label={`${cell.day}${cell.isToday ? ', today' : ''}${
                selectedDay === cell.key ? ', selected' : ''
              }${cell.hasOpen ? ', has open slots' : ''}${
                cell.hasWork ? `, ${cell.workCount} job${cell.workCount === 1 ? '' : 's'}` : ''
              }${cell.isFull ? ', fully booked' : ''}`}
              aria-disabled={!daySelectable(cell)}
              className={`relative flex touch-manipulation select-none items-center justify-center rounded-lg font-semibold leading-none transition ${cellClass} ${dayCellClass(
                {
                  status: cell.status,
                  busyLevel: cell.busyLevel,
                  showWorkLoad,
                  isSelected: selectedDay === cell.key,
                  isPast: cell.isPast,
                  isInRange: isDateKeyInRange(cell.key, rangeStart, rangeEnd),
                  openOnly,
                  allowSelectFutureDays,
                  allowFullDays,
                }
              )}`}
              title={
                cell.hasWork
                  ? `${cell.workCount} job${cell.workCount === 1 ? '' : 's'}${
                      cell.hasOpen ? ' · also has open slots' : ''
                    }`
                  : cell.hasOpen
                    ? 'Has open slots for customers'
                    : cell.isFull
                      ? 'All slots booked'
                      : allowSelectFutureDays
                        ? 'Tap to manage this day'
                        : undefined
              }
            >
              {cell.day}
              {showWorkLoad && cell.hasWork && !cell.isPast && (
                <span
                  className={`absolute right-0.5 top-0.5 min-w-[0.9rem] rounded px-0.5 text-center text-[9px] font-bold leading-tight sm:right-1 sm:top-1 ${
                    selectedDay === cell.key || cell.busyLevel === 'heavy'
                      ? 'bg-white/25 text-white'
                      : 'bg-violet-700/15 text-violet-900'
                  }`}
                >
                  {workCountLabel(cell.workCount)}
                </span>
              )}
              {showWorkLoad &&
                cell.hasWork &&
                cell.hasOpen &&
                selectedDay !== cell.key &&
                !cell.isPast && (
                  <span
                    className="absolute left-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-luminexa-accent ring-1 ring-white sm:left-1 sm:top-1"
                    aria-hidden
                  />
                )}
              {cell.isToday && selectedDay !== cell.key && !(showWorkLoad && cell.hasWork) && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-violet-500" />
              )}
              {cell.isToday && selectedDay !== cell.key && showWorkLoad && cell.hasWork && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-white/80 ring-1 ring-violet-500/40" />
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
          {showWorkLoad ? (
            <>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-luminexa-accent" />
                Open slots
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-violet-100 ring-1 ring-violet-200" />
                1 job
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-violet-300" />
                2–3 jobs
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-violet-900" />
                4+ jobs
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-luminexa-accent" />
              {openOnly || allowSelectFutureDays ? 'Open slots' : 'Available'}
            </span>
          )}
          {!showWorkLoad && (allowFullDays || !openOnly) && (
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-100 ring-1 ring-red-200" />
              Fully booked
            </span>
          )}
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
