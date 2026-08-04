import { jobsAPI } from './api';
import {
  providerBilling,
  providerMessages,
  providerRequestDetail,
  providerRequests,
  providerSchedule,
} from './providerPaths';

export const PROVIDER_NOTIFICATIONS_CHANGED_EVENT = 'luminexa:provider-notifications-changed';

/** Booking/request/payment alerts — cleared when that booking is opened. */
export const BOOKING_ACTION_KINDS = new Set([
  'new_customer_booking',
  'customer_cancelled_booking',
  'customer_reschedule_request',
  'quote_accepted',
  'payment_received',
]);

export function isProviderBookingUpdateNotification(notification) {
  return BOOKING_ACTION_KINDS.has(notification?.kind);
}

export function isPromoOfferNotification(notification) {
  return notification?.kind === 'promo_offer';
}

/** Count undismissed booking-update alerts (for Requests tab badge). */
export function countBookingActionNotifications(notifications) {
  return (notifications || []).filter(
    (n) => isProviderBookingUpdateNotification(n) && !n.dismissed_at && !n.is_read,
  ).length;
}

/**
 * Where a provider in-app alert should navigate on click.
 * Prefer link_path from the API; fall back by kind for older rows.
 */
export function providerNotificationDestination(orgSlug, n) {
  if (n?.link_path) return n.link_path;

  if (n?.kind === 'promo_offer') {
    return providerBilling(orgSlug);
  }

  if (n?.kind === 'new_message') {
    if (n.booking_id) return `${providerMessages(orgSlug)}?booking=${n.booking_id}`;
    if (n.inquiry_id) return `${providerMessages(orgSlug)}?inquiry=${n.inquiry_id}`;
    return providerMessages(orgSlug);
  }

  if (BOOKING_ACTION_KINDS.has(n?.kind)) {
    if (n.booking_id) return providerRequestDetail(orgSlug, 'booking', n.booking_id);
    return providerRequests(orgSlug);
  }

  return providerSchedule(orgSlug);
}

/** Short CTA label for Today / alert cards. */
export function providerNotificationCtaLabel(n) {
  if (n?.kind === 'promo_offer') return 'Redeem on Billing';
  if (n?.kind === 'new_message') return 'Open messages';
  if (BOOKING_ACTION_KINDS.has(n?.kind)) return 'Open request';
  return 'Open schedule';
}

export function emitProviderNotificationsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PROVIDER_NOTIFICATIONS_CHANGED_EVENT));
}

/** Dismiss one alert; ignore failures so navigation can continue. */
export async function dismissProviderNotificationQuietly(orgSlug, notificationId) {
  if (!orgSlug || !notificationId) return;
  try {
    await jobsAPI.dismissNotification(orgSlug, notificationId);
    emitProviderNotificationsChanged();
  } catch {
    /* still allow the user to open the destination */
  }
}

/**
 * Clear undismissed booking-update alerts for this booking.
 * Prefer GET booking (backend dismiss); this is a client fallback.
 * Does not clear new_message.
 */
export async function dismissProviderNotificationsForBooking(orgSlug, bookingId) {
  if (!orgSlug || !bookingId) return;
  try {
    const res = await jobsAPI.listProviderNotifications(orgSlug);
    const related = (res.data?.results || []).filter(
      (n) =>
        String(n.booking_id) === String(bookingId) &&
        isProviderBookingUpdateNotification(n),
    );
    if (!related.length) {
      emitProviderNotificationsChanged();
      return;
    }
    await Promise.all(
      related.map((n) => jobsAPI.dismissNotification(orgSlug, n.id).catch(() => {})),
    );
    emitProviderNotificationsChanged();
  } catch {
    /* non-blocking */
  }
}
