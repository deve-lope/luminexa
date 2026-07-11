/** Build calendar day map from open availability slots only. */
import { formatLocalDateKey } from './dateRange';

export function slotLocalDayKey(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return formatLocalDateKey(d);
}

export function calendarDataForMonth(calendar, year, month) {
  if (!calendar || calendar.year !== year || calendar.month !== month) {
    return { days: {}, slots_by_day: {} };
  }
  const normalized = normalizeBookingCalendar(calendar);
  return {
    days: normalized.days || {},
    slots_by_day: normalized.slots_by_day || {},
  };
}

/** Re-bucket slots and day status using the viewer's local timezone. */
export function normalizeBookingCalendar(calendar) {
  if (!calendar) return { days: {}, slots_by_day: {} };

  const rawSlotsByDay = calendar.slots_by_day || {};
  const slotsByDay = {};
  const days = { ...(calendar.days || {}) };
  const now = Date.now();

  for (const slots of Object.values(rawSlotsByDay)) {
    for (const slot of slots) {
      const key = slotLocalDayKey(slot.start_at);
      if (!key) continue;
      if (!slotsByDay[key]) slotsByDay[key] = [];
      if (!slotsByDay[key].some((s) => s.id === slot.id)) {
        slotsByDay[key].push(slot);
      }
    }
  }

  const monthPrefix =
    calendar.year && calendar.month
      ? `${calendar.year}-${String(calendar.month).padStart(2, '0')}`
      : null;

  for (const [key, slots] of Object.entries(slotsByDay)) {
    if (monthPrefix && !key.startsWith(monthPrefix)) continue;
    const open = slots.filter(
      (s) => s.available && new Date(s.start_at).getTime() > now
    );
    if (open.length > 0) {
      days[key] = {
        ...(days[key] || {}),
        status: 'available',
        open_count: open.length,
      };
    } else if (slots.length > 0 && days[key]) {
      days[key] = { ...days[key], status: 'full', open_count: 0 };
    }
  }

  return { ...calendar, days, slots_by_day: slotsByDay };
}

export function firstBookableDayKey(days) {
  return Object.keys(days || {})
    .filter((k) => days[k]?.status === 'available')
    .sort()[0];
}

export function buildOpenSlotDays(openSlots) {
  const now = Date.now();
  const days = {};
  for (const slot of openSlots || []) {
    if (slot.status !== 'open') continue;
    const start = new Date(slot.start_at);
    if (start.getTime() <= now) continue;
    const key = slotLocalDayKey(slot.start_at);
    if (!key) continue;
    if (!days[key]) {
      days[key] = { status: 'available', open_count: 0 };
    }
    days[key].open_count += 1;
  }
  return days;
}

export function openSlotsOnDay(openSlots, dayKey) {
  const now = Date.now();
  return (openSlots || [])
    .filter(
      (s) =>
        s.status === 'open' &&
        slotLocalDayKey(s.start_at) === dayKey &&
        new Date(s.start_at).getTime() > now
    )
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
}

export function openSlotsInMonth(openSlots, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return (openSlots || []).filter(
    (s) => s.status === 'open' && slotLocalDayKey(s.start_at).startsWith(prefix)
  );
}
