import { isOrgStaff } from './bookingAccess';
import { isLiveProviderMember } from './postLoginRoute';
import { firstProviderHome, providerShare } from './providerPaths';

/**
 * Provider accounts are not customers — return a dashboard URL instead of booking UI.
 * Staff of the target org go to their public page; other providers go to their home org.
 * Marketing demo users may browse/book the real marketplace like guests.
 */
export function providerBookingRedirectPath(memberships, orgSlug, user = null) {
  if (!isLiveProviderMember(user, memberships)) return null;
  if (orgSlug && isOrgStaff(memberships, orgSlug)) {
    return providerShare(orgSlug);
  }
  return firstProviderHome(memberships);
}
