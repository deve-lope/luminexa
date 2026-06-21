import { isOrgStaff } from './bookingAccess';
import { isProviderMember } from './postLoginRoute';
import { firstProviderHome, providerShare } from './providerPaths';

/**
 * Provider accounts are not customers — return a dashboard URL instead of booking UI.
 * Staff of the target org go to their public page; other providers go to their home org.
 */
export function providerBookingRedirectPath(memberships, orgSlug) {
  if (!isProviderMember(memberships)) return null;
  if (orgSlug && isOrgStaff(memberships, orgSlug)) {
    return providerShare(orgSlug);
  }
  return firstProviderHome(memberships);
}
