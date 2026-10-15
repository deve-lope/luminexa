import { firstProviderHome } from './providerPaths';
import { getOnboardingPath, needsOnboarding } from './profileSetup';

export const DJANGO_ADMIN_REDIRECT = '__DJANGO_ADMIN__';

/** In-app return path only — reject protocol-relative and empty values. */
export function isSafeNextPath(nextPath) {
  return Boolean(
    nextPath &&
      typeof nextPath === 'string' &&
      nextPath.startsWith('/') &&
      !nextPath.startsWith('//') &&
      !nextPath.includes('\\')
  );
}

export function authPathWithNext(basePath, nextPath) {
  if (!isSafeNextPath(nextPath)) return basePath;
  return `${basePath}?next=${encodeURIComponent(nextPath)}`;
}

export function isProviderMember(memberships) {
  if (!Array.isArray(memberships) || memberships.length === 0) return false;
  return memberships.some(
    (m) => m.role === 'owner' || m.role === 'staff' || m.role === 'crew'
  );
}

export function isCrewOnlyMember(memberships, orgSlug) {
  if (!Array.isArray(memberships) || !orgSlug) return false;
  const m = memberships.find((x) => x.organization_slug === orgSlug);
  return Boolean(m && m.role === 'crew');
}

export function getPostLoginRoute(user, memberships) {
  // Do not send staff to Django admin from the SPA — Authenticator 2FA is
  // only for /admin/. App login stays password/email-code like everyone else.
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
  if (!isSafeNextPath(nextPath)) {
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
  if (nextPath === '/services' || nextPath.startsWith('/services/') || nextPath.startsWith('/services?')) {
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
