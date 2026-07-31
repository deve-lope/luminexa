/** Customer booking access for a public provider storefront. */

function membershipMatchesOrg(m, providerKey) {
  if (!providerKey) return false;
  return (
    m.organization_slug === providerKey ||
    m.organization_public_ref === providerKey
  );
}

export function getCustomerMembership(memberships, providerKey) {
  return (memberships || []).find(
    (m) => membershipMatchesOrg(m, providerKey) && m.role === 'customer'
  );
}

export function isOrgStaff(memberships, providerKey) {
  return (memberships || []).some(
    (m) =>
      membershipMatchesOrg(m, providerKey) &&
      (m.role === 'owner' || m.role === 'staff')
  );
}

/** Invitation-only no longer requires a separate connect step — booking is the request. */
export function needsExplicitConnect(bookingPolicy) {
  return false;
}

export function canViewBookingCalendar({ isAuthenticated, isStaff }) {
  return isAuthenticated && !isStaff;
}

export function customerConnectionState(bookingPolicy, membership) {
  if (!membership) {
    return 'implicit';
  }
  if (membership.customer_status === 'blocked') return 'blocked';
  if (membership.customer_status === 'pending') return 'pending';
  if (membership.customer_status === 'approved') return 'approved';
  return 'connected';
}
