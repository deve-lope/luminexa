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
