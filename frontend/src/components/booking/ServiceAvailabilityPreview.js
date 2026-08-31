import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import BookingCalendar from './BookingCalendar';
import { businessesAPI } from '../../utils/api';
import { formatTimeRange } from '../../utils/datetime';
import {
  calendarDataForMonth,
  firstBookableDayKey,
  isSlotBookableForCustomer,
  normalizeBookingCalendar,
} from '../../utils/slotCalendar';

function parseApiError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Could not load availability.';
}

function slotIdsMatch(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function formatSelectedDayLabel(dayKey) {
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function SlotTimeTile({ slot, interactive, isSelected, onSelect, planningOnly = false }) {
  const label = formatTimeRange(slot.start_at, slot.end_at);
  const sharedClass =
    'flex w-full min-h-[48px] flex-col items-center justify-center rounded-xl border-2 px-2 py-2.5 text-center transition';

  if (interactive) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(slot)}
        aria-pressed={isSelected}
        className={`${sharedClass} ${
          isSelected
            ? 'border-luminexa-accent bg-teal-50 text-teal-900 shadow-sm ring-2 ring-teal-100'
            : 'border-slate-200 bg-white text-slate-800 shadow-sm hover:border-teal-300 hover:bg-teal-50/40 active:scale-[0.98]'
        }`}
      >
        <span className="text-sm font-semibold tabular-nums">{label}</span>
        {planningOnly ? (
          <span className="mt-0.5 text-[10px] font-medium text-slate-500">
            {isSelected ? 'Selected (planning)' : 'Tap to compare'}
          </span>
        ) : (
          Number(slot.capacity) > 1 &&
          Number(slot.remaining_capacity) > 0 && (
            <span className="mt-0.5 text-[10px] font-medium text-slate-500">
              {slot.remaining_capacity} left
            </span>
          )
        )}
      </button>
    );
  }

  return (
    <div
      className={`${sharedClass} border-emerald-200/90 bg-gradient-to-b from-white to-emerald-50/80 text-emerald-950 shadow-sm`}
    >
      <span className="text-sm font-semibold tabular-nums">{label}</span>
      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
        Open
      </span>
    </div>
  );
}

function captureScrollSnapshot(rootEl) {
  const modalSheet = document.querySelector('.lx-modal-sheet');
  let scrollParent = rootEl;
  while (scrollParent && scrollParent !== document.body && scrollParent !== document.documentElement) {
    const style = window.getComputedStyle(scrollParent);
    const scrollable =
      (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') &&
      scrollParent.scrollHeight > scrollParent.clientHeight + 1;
    if (scrollable) break;
    scrollParent = scrollParent.parentElement;
  }
  if (
    !scrollParent ||
    scrollParent === document.body ||
    scrollParent === document.documentElement
  ) {
    scrollParent = null;
  }
  return {
    windowY: window.scrollY || document.documentElement.scrollTop || 0,
    modalSheetTop: modalSheet?.scrollTop ?? null,
    parent: scrollParent,
    parentTop: scrollParent?.scrollTop ?? null,
  };
}

function restoreScrollSnapshot(snapshot) {
  if (!snapshot) return;
  window.scrollTo({ top: snapshot.windowY, left: 0, behavior: 'auto' });
  if (snapshot.modalSheetTop != null) {
    const modalSheet = document.querySelector('.lx-modal-sheet');
    if (modalSheet) modalSheet.scrollTop = snapshot.modalSheetTop;
  }
  if (snapshot.parent && snapshot.parentTop != null) {
    snapshot.parent.scrollTop = snapshot.parentTop;
  }
}

/**
 * Read-only (or selectable) open-slot preview for quote-first services.
 */
export default function ServiceAvailabilityPreview({
  orgSlug,
  serviceId,
  compact = false,
  title = 'When they’re available',
  hint = 'Open slots are shown so you can plan ahead. Nothing is reserved until you accept a quote and pick a time.',
  selectable = false,
  planningSelect = false,
  selectedSlotId = null,
  onSelectSlot = null,
  onPlanningChange = null,
  className = '',
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [calendar, setCalendar] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [planningSlotId, setPlanningSlotId] = useState(null);
  const sectionRef = useRef(null);
  const scrollSnapshotRef = useRef(null);

  useEffect(() => {
    setPlanningSlotId(null);
  }, [selectedDay]);

  const restoreCapturedScroll = useCallback(() => {
    if (!scrollSnapshotRef.current) return;
    restoreScrollSnapshot(scrollSnapshotRef.current);
  }, []);

  useLayoutEffect(() => {
    restoreCapturedScroll();
  });

  useEffect(() => {
    if (!scrollSnapshotRef.current || fetching) return undefined;
    const id = window.requestAnimationFrame(() => {
      restoreCapturedScroll();
      scrollSnapshotRef.current = null;
    });
    return () => window.cancelAnimationFrame(id);
  }, [fetching, calendar, restoreCapturedScroll]);

  const load = useCallback(() => {
    if (!orgSlug || !serviceId) return;
    setFetching(true);
    setError(null);
    businessesAPI
      .getServiceCalendar(orgSlug, serviceId, { year, month })
      .then((res) => {
        setCalendar(res.data);
        const normalized = normalizeBookingCalendar(res.data);
        const days = normalized?.days || {};
        const firstAvailable = firstBookableDayKey(days);
        setSelectedDay((prev) => {
          if (prev && days[prev]?.status === 'available') return prev;
          return firstAvailable || null;
        });
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setFetching(false));
  }, [orgSlug, serviceId, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const { days: calendarDays, slots_by_day: slotsByDay } = useMemo(
    () => calendarDataForMonth(calendar, year, month),
    [calendar, year, month]
  );

  const slotsForDay = useMemo(() => {
    if (!selectedDay) return [];
    return (slotsByDay[selectedDay] || []).filter((slot) => isSlotBookableForCustomer(slot));
  }, [selectedDay, slotsByDay]);

  const highlightedSlotId = selectable ? selectedSlotId : planningSlotId;

  const handleSelectDay = (dayKey) => {
    setSelectedDay(dayKey);
    if (planningSelect) {
      setPlanningSlotId(null);
      onPlanningChange?.({ dayKey, slot: null });
    }
  };

  const handleSlotSelect = (slot) => {
    if (selectable) {
      onSelectSlot?.(slot);
      return;
    }
    if (planningSelect) {
      setPlanningSlotId((prev) => {
        const nextId = slotIdsMatch(prev, slot.id) ? null : slot.id;
        onPlanningChange?.({
          dayKey: selectedDay,
          slot: nextId ? slot : null,
        });
        return nextId;
      });
    }
  };

  const shiftMonth = (delta) => {
    scrollSnapshotRef.current = captureScrollSnapshot(sectionRef.current);
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  if (!orgSlug || !serviceId) return null;

  return (
    <section
      ref={sectionRef}
      className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100 [overflow-anchor:none] ${className}`.trim()}
    >
      <header className={`border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white ${compact ? 'px-3 py-3' : 'px-4 py-3.5 sm:px-5'}`}>
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">{title}</h3>
        {hint && <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">{hint}</p>}
      </header>

      {error && (
        <p className="mx-3 mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-4">
          {error}
          <button type="button" onClick={load} className="ml-2 font-medium underline">
            Retry
          </button>
        </p>
      )}

      <div className={compact ? 'p-3' : 'p-3 sm:p-4'}>
        {fetching && !calendar ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading calendar…</p>
        ) : (
          <BookingCalendar
            year={year}
            month={month}
            days={calendarDays}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            openOnly={!selectable}
            size={compact ? 'compact' : 'full'}
          />
        )}
      </div>

      {selectedDay && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-4 sm:px-4 sm:py-5 [overflow-anchor:none]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Open times
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 sm:text-base">
                {formatSelectedDayLabel(selectedDay)}
              </p>
            </div>
            {slotsForDay.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                {slotsForDay.length} {slotsForDay.length === 1 ? 'slot' : 'slots'}
              </span>
            )}
          </div>

          {slotsForDay.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              No open slots this day — try another date on the calendar.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {slotsForDay.map((slot) => (
                <li key={slot.id}>
                  <SlotTimeTile
                    slot={slot}
                    interactive={selectable || planningSelect}
                    planningOnly={planningSelect && !selectable}
                    isSelected={slotIdsMatch(highlightedSlotId, slot.id)}
                    onSelect={handleSlotSelect}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
