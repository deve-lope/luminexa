/** Start job / Mark complete unlock this many hours before start_at. */
export const JOB_ACTION_EARLY_HOURS = 6;

export function jobActionAvailableAt(booking) {
  if (!booking?.start_at) return null;
  const start = new Date(booking.start_at);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() - JOB_ACTION_EARLY_HOURS * 60 * 60 * 1000);
}

export function canStartOrCompleteJob(booking, now = new Date()) {
  const at = jobActionAvailableAt(booking);
  if (!at) return false;
  return now.getTime() >= at.getTime();
}
