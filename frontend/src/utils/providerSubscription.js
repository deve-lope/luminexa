/** Provider Pro subscription access helpers. */

export function orgHasActiveSubscription(membership) {
  if (!membership) return false;
  if (membership.subscription_active === true) return true;
  if (membership.subscription_active === false) return false;
  const status = (membership.subscription_status || '').toLowerCase();
  return status === 'active' || status === 'trialing';
}

/** Whole days remaining until period end (0 if ending today; null if unknown). */
export function subscriptionDaysRemaining(periodEnd) {
  if (!periodEnd) return null;
  const end = new Date(periodEnd);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** Readable period-end date, e.g. "Mar 14, 2026". */
export function formatSubscriptionPeriodEnd(periodEnd) {
  if (!periodEnd) return null;
  const end = new Date(periodEnd);
  if (Number.isNaN(end.getTime())) return null;
  return end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Human remaining time (avoids "91 days left" for long promos).
 * e.g. "Ends today", "12 days left", "About 3 months left".
 */
export function formatSubscriptionRemainingLabel(periodEnd) {
  const days = subscriptionDaysRemaining(periodEnd);
  if (days == null) return null;
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day left';
  if (days < 14) return `${days} days left`;
  if (days < 45) {
    const weeks = Math.max(1, Math.round(days / 7));
    return weeks === 1 ? 'About 1 week left' : `About ${weeks} weeks left`;
  }
  const months = Math.max(1, Math.round(days / 30.44));
  return months === 1 ? 'About 1 month left' : `About ${months} months left`;
}

/** Paths providers may use before / without an active Pro subscription. */
export function isProviderSubscriptionExemptPath(pathname, orgSlug) {
  if (!orgSlug) return false;
  const base = `/provider/${orgSlug}`;
  const path = (pathname || '').replace(/\/$/, '') || '/';
  const exempt = [
    `${base}/subscribe`,
    `${base}/settings`,
    `${base}/account`,
    `${base}/billing`,
    `${base}/about`,
    `${base}/setup`,
  ];
  return exempt.some((p) => path === p || path.startsWith(`${p}/`));
}
