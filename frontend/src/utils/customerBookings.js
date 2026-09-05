import { providerCustomerKey } from './providerRouteKey';

export function bookingStatusLabel(status, { isPast = false, bookingPolicy, servicePricingType, awaitingCustomerAcceptance, customerReportedNoShow = false } = {}) {
  const needsQuote = bookingPolicy === 'quote' || servicePricingType === 'quote'
    || servicePricingType === 'range' || servicePricingType === 'average';
  if (awaitingCustomerAcceptance && status === 'requested' && !needsQuote) {
    return isPast ? 'Time change expired' : 'New time — accept to confirm';
  }
  if (awaitingCustomerAcceptance && status === 'requested' && needsQuote) {
    return isPast ? 'No quote sent' : 'New time — waiting for quote';
  }
  if (status === 'requested') {
    if (needsQuote) {
      return isPast ? 'Quote expired' : 'Awaiting quote';
    }
    return isPast ? 'Not confirmed' : 'Awaiting provider approval';
  }
  if (status === 'quoted') {
    return isPast
      ? 'Quote expired'
      : awaitingCustomerAcceptance
        ? 'Review new time & quote'
        : 'Quote ready — review & accept';
  }
  if (status === 'confirmed') {
    if (customerReportedNoShow) return 'No-show reported';
    return isPast ? 'Past appointment' : 'Confirmed';
  }
  if (status === 'in_progress') return 'In progress';
  if (status === 'needs_return') return 'Needs return visit';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'completed') return 'Completed';
  return status?.replace(/_/g, ' ') || status;
}

export function bookingStatusClass(status) {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize tracking-wide';
  if (status === 'requested') return `${base} bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/15`;
  if (status === 'quoted') return `${base} bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-600/15`;
  if (status === 'confirmed') return `${base} bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20`;
  if (status === 'in_progress') return `${base} bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-600/15`;
  if (status === 'needs_return') return `${base} bg-orange-50 text-orange-900 ring-1 ring-inset ring-orange-600/15`;
  if (status === 'cancelled') return `${base} bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-400/20`;
  if (status === 'completed') return `${base} bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-600/15`;
  return `${base} bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-400/20`;
}

export function isPastBooking(booking, now = new Date()) {
  return new Date(booking.end_at || booking.start_at) < now;
}

export function isFutureStart(booking, now = new Date()) {
  return new Date(booking.start_at) > now;
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

export function needsAttendancePrompt(booking, now = new Date()) {
  if (typeof booking?.needs_attendance_prompt === 'boolean') {
    return booking.needs_attendance_prompt;
  }
  if (booking.status !== 'confirmed') return false;
  if (booking.customer_confirmed_attendance_at || booking.customer_reported_no_show_at) {
    return false;
  }
  return isPastBooking(booking, now);
}

/** Confirmed appointments still in the future (or actively in progress). */
export function isFutureUpcomingBooking(booking, now = new Date()) {
  if (booking.status === 'completed' || booking.status === 'cancelled') return false;
  if (booking.customer_reported_no_show_at) return false;
  if (booking.status === 'in_progress') return true;
  if (booking.status === 'needs_return') return true;
  if (booking.status !== 'confirmed') return false;
  return isFutureStart(booking, now);
}

/** Past confirmed visit waiting on a show-up answer — shown at top of Upcoming, not as a future job. */
export function isAttendanceFollowUp(booking, now = new Date()) {
  return needsAttendancePrompt(booking, now);
}

/** @deprecated use isFutureUpcomingBooking or isAttendanceFollowUp */
export function isConfirmedUpcomingBooking(booking, now = new Date()) {
  return isFutureUpcomingBooking(booking, now) || isAttendanceFollowUp(booking, now);
}

/** Booking still waiting on a quote or provider/customer acceptance. */
export function isPendingQuoteBooking(booking, now = new Date()) {
  if (booking.status !== 'requested' && booking.status !== 'quoted') return false;
  return !isPastBooking(booking, now);
}

export const ACTIVE_INQUIRY_STATUSES = new Set(['pending', 'active', 'quoted', 'quote_accepted']);

export function isActiveInquiry(inquiry) {
  if (inquiry?.dismissed_at) return false;
  return ACTIVE_INQUIRY_STATUSES.has(inquiry?.status);
}

export function isCompletedBooking(booking) {
  return booking?.status === 'completed';
}

export function isClosedInquiry(inquiry) {
  return (
    !isActiveInquiry(inquiry) &&
    (inquiry.status === 'declined' ||
      inquiry.status === 'cancelled' ||
      Boolean(inquiry.dismissed_at))
  );
}

/** Cancelled, expired, or declined bookings — not completed, not open quotes, not future/upcoming. */
export function isClosedBooking(booking, now = new Date()) {
  if (isCompletedBooking(booking)) return false;
  if (isFutureUpcomingBooking(booking, now)) return false;
  if (isAttendanceFollowUp(booking, now)) return false;
  if (isPendingQuoteBooking(booking, now)) return false;
  return true;
}

/** @deprecated use isClosedBooking */
export function isHistoryBooking(booking, now = new Date()) {
  return isClosedBooking(booking, now);
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
  if (booking.status !== 'requested' && booking.status !== 'quoted' && booking.status !== 'confirmed') {
    return false;
  }
  if (new Date(booking.start_at) <= now) return false;
  if (booking.status === 'requested' || booking.status === 'quoted') return true;
  const cutoff = Number(booking.cancel_cutoff_hours ?? 0);
  if (!cutoff || cutoff <= 0) return true;
  const hoursLeft = (new Date(booking.start_at) - now) / 3600000;
  return hoursLeft >= cutoff;
}

export function canRescheduleBooking(booking, now = new Date()) {
  if (typeof booking?.can_customer_reschedule === 'boolean') {
    return booking.can_customer_reschedule;
  }
  if (!providerCustomerKey(booking) || !booking.service) return false;
  if (new Date(booking.start_at) <= now) return false;

  if (isUntouchedBookingRequest(booking) || booking.status === 'quoted') return true;

  if (booking.status === 'confirmed') {
    const cutoff = Number(booking.cancel_cutoff_hours ?? 0);
    if (!cutoff || cutoff <= 0) return true;
    const hoursLeft = (new Date(booking.start_at) - now) / 3600000;
    return hoursLeft >= cutoff;
  }

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
