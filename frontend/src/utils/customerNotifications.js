import { customerBookingDetail, customerBookings } from './customerPaths';
import { jobsAPI } from './api';

export const NOTIFICATIONS_CHANGED_EVENT = 'luminexa:notifications-changed';

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
 * Clear any undismissed customer alerts for this booking
 * (e.g. after opening the appointment detail once).
 */
export async function dismissNotificationsForBooking(bookingId) {
  if (!bookingId) return;
  try {
    const res = await jobsAPI.listMyNotifications();
    const related = (res.data?.results || []).filter(
      (n) => String(n.booking_id) === String(bookingId),
    );
    if (!related.length) return;
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
