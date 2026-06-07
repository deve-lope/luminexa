/** Build calendar day map from open availability slots only. */
export function buildOpenSlotDays(openSlots) {
  const now = Date.now();
  const days = {};
  for (const slot of openSlots || []) {
    if (slot.status !== 'open') continue;
    const start = new Date(slot.start_at);
    if (start.getTime() <= now) continue;
    const key = slot.start_at.slice(0, 10);
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
    .filter((s) => s.status === 'open' && s.start_at.startsWith(dayKey) && new Date(s.start_at).getTime() > now)
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
}

export function openSlotsInMonth(openSlots, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return (openSlots || []).filter(
    (s) => s.status === 'open' && s.start_at.startsWith(prefix)
  );
}
