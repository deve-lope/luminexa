/** Customer booking access for a public provider storefront. */

export function getCustomerMembership(memberships, orgSlug) {
  return (memberships || []).find(
    (m) => m.organization_slug === orgSlug && m.role === 'customer'
  );
}

export function isOrgStaff(memberships, orgSlug) {
  return (memberships || []).some(
    (m) =>
      m.organization_slug === orgSlug &&
      (m.role === 'owner' || m.role === 'staff')
  );
}

/** Request-access-first businesses require provider approval before booking. */
export function needsExplicitConnect(bookingPolicy) {
  return bookingPolicy === 'clients_only';
}

export function canViewBookingCalendar({ isAuthenticated, isStaff }) {
  return isAuthenticated && !isStaff;
}

export function customerConnectionState(bookingPolicy, membership) {
  if (!membership) {
    return needsExplicitConnect(bookingPolicy) ? 'disconnected' : 'implicit';
  }
  if (membership.customer_status === 'pending') return 'pending';
  if (membership.customer_status === 'approved') return 'approved';
  return 'connected';
}
