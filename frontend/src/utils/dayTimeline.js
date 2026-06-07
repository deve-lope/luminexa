/** Python weekday on WeeklyScheduleBlock: 0=Mon … 6=Sun */
export function jsDateToModelWeekday(date) {
  const js = date.getDay();
  return js === 0 ? 6 : js - 1;
}

/** Working windows for a calendar day from weekly blocks. */
export function workingWindowsForDay(dayKey, weeklyBlocks) {
  const d = new Date(`${dayKey}T12:00:00`);
  const weekday = jsDateToModelWeekday(d);
  const blocks = (weeklyBlocks || []).filter(
    (b) => b.is_active !== false && Number(b.weekday) === weekday
  );
  if (!blocks.length) return null;
  return blocks.map((b) => {
    const [sh, sm] = b.start_time.split(':').map(Number);
    const [eh, em] = b.end_time.split(':').map(Number);
    const start = new Date(`${dayKey}T00:00:00`);
    start.setHours(sh, sm || 0, 0, 0);
    const end = new Date(`${dayKey}T00:00:00`);
    end.setHours(eh, em || 0, 0, 0);
    return { startMs: start.getTime(), endMs: end.getTime() };
  });
}

export function defaultDayBounds(dayKey, weeklyBlocks) {
  const windows = workingWindowsForDay(dayKey, weeklyBlocks);
  if (windows?.length) {
    const startMs = Math.min(...windows.map((w) => w.startMs));
    const endMs = Math.max(...windows.map((w) => w.endMs));
    const pad = 30 * 60 * 1000;
    return { startMs: startMs - pad, endMs: endMs + pad, workingWindows: windows };
  }
  const start = new Date(`${dayKey}T07:00:00`);
  const end = new Date(`${dayKey}T19:00:00`);
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    workingWindows: [{ startMs: start.getTime(), endMs: end.getTime() }],
  };
}

function inWindow(ms, startMs, endMs) {
  return ms >= startMs && ms < endMs;
}

function overlaps(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}

function typeAt(ms, { slots, unavailable, workingWindows }) {
  for (const s of slots) {
    const st = new Date(s.start_at).getTime();
    const en = new Date(s.end_at).getTime();
    if (inWindow(ms, st, en)) {
      if (s.status === 'booked') return 'booked';
      if (s.status === 'pending') return 'pending';
      if (s.status === 'open') return 'open';
    }
  }
  for (const u of unavailable) {
    const st = new Date(u.start_at).getTime();
    const en = new Date(u.end_at).getTime();
    if (inWindow(ms, st, en)) return 'unavailable';
  }
  const inWorking = (workingWindows || []).some((w) => inWindow(ms, w.startMs, w.endMs));
  return inWorking ? 'idle' : 'off_hours';
}

/**
 * Build horizontal timeline segments for one day.
 * @returns {{ segments: Array, bounds: { startMs, endMs }, markers: Array }}
 */
export function buildDayTimeline(dayKey, { slots = [], unavailable = [], weeklyBlocks = [] }) {
  const { startMs, endMs, workingWindows } = defaultDayBounds(dayKey, weeklyBlocks);

  const daySlots = slots.filter((s) => s.start_at.startsWith(dayKey));
  const dayUnavailable = unavailable.filter((u) => u.start_at.startsWith(dayKey));

  const points = new Set([startMs, endMs]);
  for (const s of daySlots) {
    points.add(new Date(s.start_at).getTime());
    points.add(new Date(s.end_at).getTime());
  }
  for (const u of dayUnavailable) {
    points.add(new Date(u.start_at).getTime());
    points.add(new Date(u.end_at).getTime());
  }
  for (const w of workingWindows) {
    if (w.startMs >= startMs && w.startMs <= endMs) points.add(w.startMs);
    if (w.endMs >= startMs && w.endMs <= endMs) points.add(w.endMs);
  }

  const sorted = [...points].filter((p) => p >= startMs && p <= endMs).sort((a, b) => a - b);
  const ctx = { slots: daySlots, unavailable: dayUnavailable, workingWindows };
  const span = endMs - startMs || 1;

  const segments = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const t0 = sorted[i];
    const t1 = sorted[i + 1];
    if (t1 <= t0) continue;
    const mid = (t0 + t1) / 2;
    const type = typeAt(mid, ctx);
    const prev = segments[segments.length - 1];
    if (prev && prev.type === type && prev.endMs === t0) {
      prev.endMs = t1;
      prev.widthPct = ((prev.endMs - prev.startMs) / span) * 100;
    } else {
      const slot = daySlots.find((s) => {
        const st = new Date(s.start_at).getTime();
        const en = new Date(s.end_at).getTime();
        return overlaps(t0, t1, st, en) && (s.status === 'open' || s.status === 'booked' || s.status === 'pending');
      });
      const block = dayUnavailable.find((u) => {
        const st = new Date(u.start_at).getTime();
        const en = new Date(u.end_at).getTime();
        return overlaps(t0, t1, st, en);
      });
      segments.push({
        type,
        startMs: t0,
        endMs: t1,
        widthPct: ((t1 - t0) / span) * 100,
        slot: type === 'open' || type === 'booked' || type === 'pending' ? slot : null,
        block: type === 'unavailable' ? block : null,
      });
    }
  }

  const markers = sorted.map((ms) => ({
    ms,
    leftPct: ((ms - startMs) / span) * 100,
    label: new Date(ms).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
  }));

  return { segments, bounds: { startMs, endMs }, markers };
}

export const TIMELINE_COLORS = {
  booked: 'bg-violet-600 hover:bg-violet-700',
  pending: 'bg-amber-500 hover:bg-amber-600',
  open: 'bg-emerald-500 hover:bg-emerald-600',
  unavailable: 'bg-slate-500 hover:bg-slate-600',
  idle: 'bg-slate-200 hover:bg-slate-300',
  off_hours: 'bg-slate-100',
};

export const TIMELINE_LABELS = {
  booked: 'Booked',
  pending: 'Pending',
  open: 'Available',
  unavailable: 'Unavailable',
  idle: 'Free',
  off_hours: 'Off hours',
};

/** Combine datetime-local time with day key. */
export function dayTimeToIso(dayKey, timeValue) {
  if (!dayKey || !timeValue) return '';
  return new Date(`${dayKey}T${timeValue}`).toISOString();
}
