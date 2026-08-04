import { customerBookingDetail, customerBookings } from './customerPaths';
import { jobsAPI } from './api';

export const NOTIFICATIONS_CHANGED_EVENT = 'luminexa:notifications-changed';

/** Booking/status/quote/invoice alerts — cleared when that booking is opened. */
export const CUSTOMER_BOOKING_UPDATE_KINDS = new Set([
  'booking_confirmed',
  'booking_declined',
  'booking_cancelled',
  'booking_rescheduled',
  'booking_time_change',
  'booking_completed',
  'invoice_ready',
  'payment_confirmed',
]);

export function isCustomerBookingUpdateNotification(notification) {
  return CUSTOMER_BOOKING_UPDATE_KINDS.has(notification?.kind);
}

/** Count undismissed booking-update alerts (for Bookings tab badge). */
export function countBookingUpdateNotifications(notifications) {
  return (notifications || []).filter(
    (n) => isCustomerBookingUpdateNotification(n) && !n.dismissed_at && !n.is_read,
  ).length;
}

/** Prefer the booking detail page when the alert is tied to a booking. */
export function notificationDestination(notification) {
  if (notification?.booking_id) {
    return customerBookingDetail(notification.booking_id);
  }
  return notification?.link_path || customerBookings();
}

export function emitNotificationsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

/** Mark one update as read; ignore failures so navigation can continue. */
export async function dismissNotificationQuietly(notificationId) {
  if (!notificationId) return;
  try {
    await jobsAPI.dismissMyNotification(notificationId);
    emitNotificationsChanged();
  } catch {
    /* still allow the user to open the destination */
  }
}

/**
 * Clear undismissed booking-update alerts for this booking.
 * Prefer GET booking (backend dismiss); this is a client fallback.
 * Does not clear new_message (that happens when the thread is opened).
 */
export async function dismissNotificationsForBooking(bookingId) {
  if (!bookingId) return;
  try {
    const res = await jobsAPI.listMyNotifications();
    const related = (res.data?.results || []).filter(
      (n) =>
        String(n.booking_id) === String(bookingId) &&
        isCustomerBookingUpdateNotification(n),
    );
    if (!related.length) {
      emitNotificationsChanged();
      return;
    }
    await Promise.all(related.map((n) => jobsAPI.dismissMyNotification(n.id).catch(() => {})));
    emitNotificationsChanged();
  } catch {
    /* non-blocking */
  }
}

/** Mark every undismissed update as read. */
export async function dismissAllNotifications() {
  await jobsAPI.dismissAllMyNotifications();
  emitNotificationsChanged();
}
