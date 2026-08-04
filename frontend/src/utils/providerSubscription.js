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
