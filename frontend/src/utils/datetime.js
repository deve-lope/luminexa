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
