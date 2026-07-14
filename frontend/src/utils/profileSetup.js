import { hasValidSavedServiceAddress } from '../components/customer/ServiceLocationInput';
import { isProviderMember } from './postLoginRoute';
import { firstProviderHome, providerHome } from './providerPaths';

const OPTIONAL_SKIP_PREFIX = 'lx_provider_optional_setup_skipped:';

export function needsOnboarding(user) {
  if (!user) return false;
  return user.needs_onboarding === true;
}

export function customerContactIncomplete(user) {
  if (!user) return true;
  return (
    !(user.full_name || '').trim() ||
    !(user.phone || '').trim() ||
    !hasValidSavedServiceAddress(user)
  );
}

export function providerContactIncomplete(user) {
  if (!user) return true;
  return !(user.full_name || '').trim() || !(user.phone || '').trim();
}

export function getOnboardingPath(user, memberships, nextPath) {
  if (!needsOnboarding(user)) return null;
  const q = nextPath && nextPath.startsWith('/') ? `?next=${encodeURIComponent(nextPath)}` : '';
  if (isProviderMember(memberships)) {
    const home = firstProviderHome(memberships);
    const slug = home.split('/').filter(Boolean).pop();
    return slug ? `/provider/${slug}/setup${q}` : `/provider/setup${q}`;
  }
  return `/customer/setup${q}`;
}

export function hasSkippedProviderOptionalSetup(orgSlug) {
  if (!orgSlug || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`${OPTIONAL_SKIP_PREFIX}${orgSlug}`) === '1';
  } catch {
    return false;
  }
}

export function markProviderOptionalSetupSkipped(orgSlug) {
  if (!orgSlug || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${OPTIONAL_SKIP_PREFIX}${orgSlug}`, '1');
  } catch {
    /* ignore */
  }
}

export function providerOptionalSetupPath(orgSlug) {
  return `${providerHome(orgSlug)}/setup?step=profile`;
}
