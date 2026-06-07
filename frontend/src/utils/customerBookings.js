export function bookingStatusLabel(status, { isPast = false } = {}) {
  if (status === 'requested') {
    return isPast ? 'Not confirmed' : 'Awaiting provider approval';
  }
  if (status === 'confirmed') return isPast ? 'Confirmed (past)' : 'Confirmed';
  if (status === 'in_progress') return 'In progress';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'completed') return 'Completed';
  return status?.replace(/_/g, ' ') || status;
}

export function bookingStatusClass(status) {
  if (status === 'requested') return 'bg-amber-100 text-amber-800';
  if (status === 'confirmed') return 'bg-emerald-100 text-emerald-800';
  if (status === 'in_progress') return 'bg-sky-100 text-sky-800';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-600';
  if (status === 'completed') return 'bg-violet-100 text-violet-800';
  return 'bg-slate-100 text-slate-700';
}

export function isPastBooking(booking, now = new Date()) {
  return new Date(booking.end_at || booking.start_at) < now;
}

export function isUpcomingBooking(booking, now = new Date()) {
  if (booking.status === 'completed' || booking.status === 'cancelled') return false;
  return !isPastBooking(booking, now);
}

export function isHistoryBooking(booking, now = new Date()) {
  return !isUpcomingBooking(booking, now);
}

export function canCancelBooking(booking, now = new Date()) {
  return (
    (booking.status === 'requested' || booking.status === 'confirmed') &&
    new Date(booking.start_at) > now
  );
}

export function canRescheduleBooking(booking, now = new Date()) {
  return (
    canCancelBooking(booking, now) &&
    booking.organization_slug &&
    booking.service
  );
}

export function wasApprovedByProvider(booking) {
  if (booking.status === 'confirmed' || booking.status === 'completed' || booking.status === 'in_progress') {
    return true;
  }
  return (booking.status_events || []).some((ev) => ev.action === 'accepted');
}

export function wasDeclinedByProvider(booking) {
  return (
    booking.status === 'cancelled' &&
    (booking.status_events || []).some((ev) => ev.action === 'declined')
  );
}
