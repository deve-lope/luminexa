/** Always 12-hour with AM/PM so booking times stay clear across locales. */
const TIME_OPTS = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

/** ISO timestamps previously embedded in BookingStatusEvent.note text. */
const ISO_IN_TEXT =
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g;

export function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...TIME_OPTS,
  });
}

export function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, TIME_OPTS);
}

/** Rewrite legacy ISO timestamps inside activity notes to AM/PM display. */
export function humanizeActivityNote(note) {
  if (!note) return '';
  return String(note).replace(ISO_IN_TEXT, (raw) => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return formatWhen(d.toISOString());
  });
}

export function formatTimeRange(startIso, endIso) {
  if (!startIso) return '';
  const start = formatTime(startIso);
  if (!endIso) return start;
  return `${start} – ${formatTime(endIso)}`;
}

/**
 * Compact single-line range for narrow slot tiles (avoids "AM" wrapping alone).
 * Same period → "8:00–9:00 AM"; otherwise → "11:00 AM–1:00 PM".
 */
export function formatTimeRangeCompact(startIso, endIso) {
  if (!startIso) return '';
  const startDate = new Date(startIso);
  if (Number.isNaN(startDate.getTime())) return '';
  if (!endIso) return formatTime(startIso);

  const endDate = new Date(endIso);
  if (Number.isNaN(endDate.getTime())) return formatTime(startIso);

  const startPeriod = startDate.getHours() < 12 ? 'AM' : 'PM';
  const endPeriod = endDate.getHours() < 12 ? 'AM' : 'PM';
  const clock = (d) => {
    const h24 = d.getHours();
    const h12 = h24 % 12 || 12;
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${h12}:${mins}`;
  };

  if (startPeriod === endPeriod) {
    return `${clock(startDate)}–${clock(endDate)} ${endPeriod}`;
  }
  return `${clock(startDate)} ${startPeriod}–${clock(endDate)} ${endPeriod}`;
}

export function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatMonthYear(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}
