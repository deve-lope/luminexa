import { defaultDayBounds } from './dayTimeline';
import { formatTime } from './datetime';

export const MIN_RANGE_MS = 15 * 60 * 1000;
export const SNAP_MS = 15 * 60 * 1000;

/** HH:mm for a local timestamp (for <select> values). */
export function msToTimeValue(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timeValueToMs(dayKey, timeStr) {
  const [h, m] = String(timeStr || '00:00').split(':').map(Number);
  const d = new Date(`${dayKey}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

/** 15-minute From/Until options spanning the day working bounds. */
export function buildDayTimeOptions(dayKey, weeklyBlocks) {
  if (!dayKey) return [];
  const bounds = defaultDayBounds(dayKey, weeklyBlocks);
  const opts = [];
  for (let ms = snapMs(bounds.startMs); ms <= bounds.endMs; ms += SNAP_MS) {
    opts.push({
      value: msToTimeValue(ms),
      label: formatTime(new Date(ms).toISOString()),
      ms,
    });
  }
  return opts;
}

/**
 * Default range when staff picks Open / Unavailable / Book — no dragging required.
 */
export function suggestDefaultDraftRange({
  dayKey,
  weeklyBlocks,
  durationMinutes = 60,
}) {
  if (!dayKey) return null;
  const bounds = defaultDayBounds(dayKey, weeklyBlocks);
  const windows = bounds.workingWindows || [];
  const durationMs = Math.max(MIN_RANGE_MS, Number(durationMinutes || 60) * 60 * 1000);
  const now = Date.now();
  const windowStart = windows[0]?.startMs ?? new Date(`${dayKey}T09:00:00`).getTime();
  const dayEnd = new Date(`${dayKey}T23:59:59`).getTime();

  let startMs;
  if (now > dayEnd) {
    startMs = snapMs(windowStart);
  } else {
    startMs = snapMs(Math.max(now + SNAP_MS, windowStart));
  }
  if (startMs + durationMs > bounds.endMs) {
    startMs = snapMs(Math.max(bounds.startMs, bounds.endMs - durationMs));
  }
  return normalizeRange(startMs, startMs + durationMs, bounds);
}

export function snapMs(ms, snap = SNAP_MS) {
  return Math.round(ms / snap) * snap;
}

export function msToPercent(ms, startMs, endMs) {
  const span = endMs - startMs || 1;
  return Math.max(0, Math.min(100, ((ms - startMs) / span) * 100));
}

export function percentToMs(pct, startMs, endMs) {
  const span = endMs - startMs || 1;
  return startMs + (pct / 100) * span;
}

export function pointerToMs(clientX, rect, startMs, endMs) {
  const pct = ((clientX - rect.left) / rect.width) * 100;
  return snapMs(percentToMs(pct, startMs, endMs));
}

/** clientX from mouse or touch event */
export function eventClientX(e) {
  if (e.touches?.length) return e.touches[0].clientX;
  if (e.changedTouches?.length) return e.changedTouches[0].clientX;
  return e.clientX;
}

export function formatMsRange(startMs, endMs) {
  if (!startMs || !endMs) return '';
  return `${formatTime(new Date(startMs).toISOString())} – ${formatTime(new Date(endMs).toISOString())}`;
}

export function normalizeRange(startMs, endMs, bounds, minMs = MIN_RANGE_MS) {
  let a = snapMs(Math.min(startMs, endMs));
  let b = snapMs(Math.max(startMs, endMs));
  if (b - a < minMs) b = a + minMs;
  a = Math.max(a, bounds.startMs);
  b = Math.min(b, bounds.endMs);
  if (b - a < minMs) return null;
  return { startMs: a, endMs: b };
}

export function rangeOverlapsBooked(startMs, endMs, { slots = [] }) {
  for (const s of slots) {
    if (s.status !== 'booked') continue;
    const st = new Date(s.start_at).getTime();
    const en = new Date(s.end_at).getTime();
    if (startMs < en && endMs > st) return true;
  }
  return false;
}

/**
 * @param {object} opts
 * @param {boolean} [opts.ignoreOpenSlots] - when marking unavailable, open slots are removed on save
 * @param {boolean} [opts.ignorePendingSlots] - pending requests are declined on save
 */
export function rangeOverlapsExisting(
  startMs,
  endMs,
  { slots = [], unavailable = [], ignoreOpenSlots = false, ignorePendingSlots = false }
) {
  for (const s of slots) {
    if (ignoreOpenSlots && s.status === 'open') continue;
    if (ignorePendingSlots && s.status === 'pending') continue;
    const st = new Date(s.start_at).getTime();
    const en = new Date(s.end_at).getTime();
    if (startMs < en && endMs > st) return true;
  }
  for (const u of unavailable) {
    const st = new Date(u.start_at).getTime();
    const en = new Date(u.end_at).getTime();
    if (startMs < en && endMs > st) return true;
  }
  return false;
}

/** Validate draft range for schedule add modes. */
export function validateDraftRange(startMs, endMs, { addMode, slots, unavailable }) {
  if (rangeOverlapsBooked(startMs, endMs, { slots })) {
    return 'A confirmed booking is in this time — choose another range.';
  }
  // Staff can book over open slots (fills them). Unavailable mode removes open slots on save.
  const ignoreOpen = addMode === 'unavailable' || addMode === 'book';
  const ignorePending = addMode === 'unavailable';
  if (
    rangeOverlapsExisting(startMs, endMs, {
      slots,
      unavailable,
      ignoreOpenSlots: ignoreOpen,
      ignorePendingSlots: ignorePending,
    })
  ) {
    if (addMode === 'unavailable') {
      return 'Overlaps another unavailable block — choose a different range.';
    }
    if (addMode === 'book') {
      return 'That time is blocked or has a pending request — pick another.';
    }
    return 'Overlaps existing time — choose a free area.';
  }
  return null;
}

/**
 * Reduce axis labels so they do not overlap on narrow timelines.
 * Returns markers with align: 'start' | 'middle' | 'end'.
 */
export function pickTimelineDisplayMarkers(markers, { minGapPct = 14, maxLabels = 5 } = {}) {
  if (!markers?.length) return [];
  const sorted = [...markers].sort((a, b) => a.leftPct - b.leftPct);
  const start = { ...sorted[0], align: 'start' };
  const end = { ...sorted[sorted.length - 1], align: 'end' };

  if (sorted.length === 1) return [start];
  if (end.leftPct - start.leftPct < minGapPct * 1.5) {
    return end.ms === start.ms ? [start] : [start, end];
  }

  const spanMs = end.ms - start.ms || 1;
  const hourMs = 60 * 60 * 1000;
  const hourTicks = [];
  let t = Math.ceil(start.ms / hourMs) * hourMs;
  while (t < end.ms) {
    hourTicks.push({
      ms: t,
      leftPct: ((t - start.ms) / spanMs) * 100,
      label: formatTime(new Date(t).toISOString()),
      align: 'middle',
    });
    t += hourMs;
  }

  const chosen = [start];
  for (const tick of hourTicks) {
    if (chosen.length >= maxLabels - 1) break;
    const last = chosen[chosen.length - 1];
    if (tick.leftPct - last.leftPct >= minGapPct && end.leftPct - tick.leftPct >= minGapPct) {
      chosen.push(tick);
    }
  }

  const last = chosen[chosen.length - 1];
  if (end.leftPct - last.leftPct < minGapPct) {
    if (chosen.length > 1) chosen[chosen.length - 1] = end;
    else chosen.push(end);
  } else {
    chosen.push(end);
  }

  return chosen;
}

export const ADD_MODE_META = {
  open: {
    label: 'Open slot',
    description: 'Customers can book this time',
    color: 'bg-emerald-500',
    border: 'border-emerald-600',
    ring: 'ring-emerald-400',
    text: 'text-emerald-900',
    light: 'bg-emerald-50',
  },
  unavailable: {
    label: 'Unavailable',
    description: 'Block time off (lunch, travel…)',
    color: 'bg-slate-500',
    border: 'border-slate-600',
    ring: 'ring-slate-400',
    text: 'text-slate-900',
    light: 'bg-slate-100',
  },
  book: {
    label: 'Book customer',
    description: 'Book an existing client or a new caller',
    color: 'bg-violet-600',
    border: 'border-violet-700',
    ring: 'ring-violet-400',
    text: 'text-violet-900',
    light: 'bg-violet-50',
  },
};
