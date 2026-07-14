import { providerCustomerKey } from './providerRouteKey';

export function bookingStatusLabel(status, { isPast = false } = {}) {
  if (status === 'requested') {
    return isPast ? 'Not confirmed' : 'Awaiting provider approval';
  }
  if (status === 'confirmed') return isPast ? 'Confirmed (past)' : 'Confirmed';
  if (status === 'in_progress') return 'In progress';
  if (status === 'needs_return') return 'Needs return visit';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'completed') return 'Completed';
  return status?.replace(/_/g, ' ') || status;
}

export function bookingStatusClass(status) {
  if (status === 'requested') return 'bg-amber-100 text-amber-800';
  if (status === 'confirmed') return 'bg-emerald-100 text-emerald-800';
  if (status === 'in_progress') return 'bg-sky-100 text-sky-800';
  if (status === 'needs_return') return 'bg-orange-100 text-orange-900';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-600';
  if (status === 'completed') return 'bg-violet-100 text-violet-800';
  return 'bg-slate-100 text-slate-700';
}

export function isPastBooking(booking, now = new Date()) {
  return new Date(booking.end_at || booking.start_at) < now;
}

export function isUpcomingBooking(booking, now = new Date()) {
  if (
    booking.status === 'completed' ||
    booking.status === 'cancelled' ||
    booking.status === 'needs_return'
  ) {
    return false;
  }
  return !isPastBooking(booking, now);
}

export function isHistoryBooking(booking, now = new Date()) {
  return !isUpcomingBooking(booking, now);
}

/** Booking request still waiting on the provider (not approved or declined). */
export function isUntouchedBookingRequest(booking) {
  if (booking.status !== 'requested') return false;
  const events = booking.status_events || [];
  return !events.some((ev) => ev.action === 'accepted' || ev.action === 'declined');
}

export function canCancelBooking(booking, now = new Date()) {
  if (typeof booking?.can_customer_cancel === 'boolean') {
    return booking.can_customer_cancel;
  }
  if (booking.status !== 'requested' && booking.status !== 'confirmed') return false;
  if (new Date(booking.start_at) <= now) return false;
  if (booking.status === 'requested') return true;
  const cutoff = Number(booking.cancel_cutoff_hours ?? 0);
  if (!cutoff || cutoff <= 0) return true;
  const hoursLeft = (new Date(booking.start_at) - now) / 3600000;
  return hoursLeft >= cutoff;
}

export function canRescheduleBooking(booking, now = new Date()) {
  if (!providerCustomerKey(booking) || !booking.service) return false;
  if (new Date(booking.start_at) <= now) return false;

  // Pending request with no provider decision yet — customer may pick another slot.
  if (isUntouchedBookingRequest(booking)) return true;

  // Confirmed appointments — customer may request a new time (provider approves).
  if (booking.status === 'confirmed') return true;

  return false;
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
