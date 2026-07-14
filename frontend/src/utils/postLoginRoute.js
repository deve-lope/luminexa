import { getDjangoAdminUrl } from './djangoAdmin';
import { firstProviderHome } from './providerPaths';
import { getOnboardingPath, needsOnboarding } from './profileSetup';

export const DJANGO_ADMIN_REDIRECT = '__DJANGO_ADMIN__';

export function isProviderMember(memberships) {
  if (!Array.isArray(memberships) || memberships.length === 0) return false;
  return memberships.some((m) => m.role === 'owner' || m.role === 'staff');
}

export function getPostLoginRoute(user, memberships) {
  if (user?.is_staff) return getDjangoAdminUrl();
  const onboarding = getOnboardingPath(user, memberships);
  if (onboarding) return onboarding;
  if (isProviderMember(memberships)) return firstProviderHome(memberships);
  return '/customer';
}

/** After login/register, prefer `next` when it is a customer booking or browse path. */
export function resolvePathAfterAuth(nextPath, user, memberships) {
  if (needsOnboarding(user)) {
    return getOnboardingPath(user, memberships, nextPath) || getPostLoginRoute(user, memberships);
  }
  if (!nextPath || !nextPath.startsWith('/')) {
    return getPostLoginRoute(user, memberships);
  }
  if (nextPath.includes('/setup')) {
    return nextPath;
  }
  if (nextPath.startsWith('/book/')) {
    if (isProviderMember(memberships)) return firstProviderHome(memberships);
    return nextPath;
  }
  if (nextPath.startsWith('/customer') && !isProviderMember(memberships)) return nextPath;
  if (nextPath.startsWith('/customer') && isProviderMember(memberships)) {
    return firstProviderHome(memberships);
  }
  if (nextPath === '/services' || nextPath.startsWith('/services?')) {
    if (isProviderMember(memberships)) return firstProviderHome(memberships);
    return nextPath;
  }
  if (nextPath === '/provider' && isProviderMember(memberships)) {
    return firstProviderHome(memberships);
  }
  return nextPath;
}

export function applyPostLoginNavigation(navigate, user, memberships, nextPath) {
  const path = resolvePathAfterAuth(nextPath, user, memberships);
  if (path.startsWith('http')) {
    window.location.href = path;
    return;
  }
  navigate(path, { replace: true });
}
