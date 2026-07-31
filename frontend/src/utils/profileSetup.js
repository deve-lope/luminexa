import { hasValidSavedServiceAddress } from '../components/customer/ServiceLocationInput';
import { isProviderMember } from './postLoginRoute';
import { firstProviderHome, providerHome } from './providerPaths';

const OPTIONAL_SKIP_PREFIX = 'lx_provider_optional_setup_skipped:';
const WIZARD_DONE_PREFIX = 'lx_provider_setup_wizard_done:';
const WIZARD_PROGRESS_PREFIX = 'lx_provider_setup_progress:';

/** Owner guided steps after required contact (all skippable). */
export const PROVIDER_WIZARD_STEPS = ['availability', 'service_area', 'services', 'profile'];

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

function readProgress(orgSlug) {
  if (!orgSlug || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`${WIZARD_PROGRESS_PREFIX}${orgSlug}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeProgress(orgSlug, progress) {
  if (!orgSlug || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${WIZARD_PROGRESS_PREFIX}${orgSlug}`, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

/** Mark a wizard step as done (and any steps before it). */
export function markProviderWizardStepDone(orgSlug, step) {
  if (!orgSlug || !PROVIDER_WIZARD_STEPS.includes(step)) return;
  const progress = readProgress(orgSlug);
  const idx = PROVIDER_WIZARD_STEPS.indexOf(step);
  PROVIDER_WIZARD_STEPS.forEach((s, i) => {
    if (i <= idx) progress[s] = true;
  });
  writeProgress(orgSlug, progress);
  if (PROVIDER_WIZARD_STEPS.every((s) => progress[s])) {
    markProviderSetupWizardDone(orgSlug);
  }
}

export function isProviderWizardStepDone(orgSlug, step) {
  if (hasFinishedProviderSetupWizard(orgSlug)) return true;
  return Boolean(readProgress(orgSlug)[step]);
}

/** First incomplete optional step, or null if wizard is finished. */
export function getResumeProviderWizardStep(orgSlug) {
  if (hasFinishedProviderSetupWizard(orgSlug)) return null;
  const progress = readProgress(orgSlug);
  return PROVIDER_WIZARD_STEPS.find((s) => !progress[s]) || null;
}

export function providerResumeSetupPath(orgSlug) {
  const step = getResumeProviderWizardStep(orgSlug) || 'availability';
  return providerSetupPath(orgSlug, step);
}

export function hasSkippedProviderOptionalSetup(orgSlug) {
  if (!orgSlug || typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage.getItem(`${WIZARD_DONE_PREFIX}${orgSlug}`) === '1' ||
      window.localStorage.getItem(`${OPTIONAL_SKIP_PREFIX}${orgSlug}`) === '1'
    );
  } catch {
    return false;
  }
}

export function markProviderOptionalSetupSkipped(orgSlug) {
  markProviderSetupWizardDone(orgSlug);
}

export function hasFinishedProviderSetupWizard(orgSlug) {
  return hasSkippedProviderOptionalSetup(orgSlug);
}

export function markProviderSetupWizardDone(orgSlug) {
  if (!orgSlug || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${WIZARD_DONE_PREFIX}${orgSlug}`, '1');
    window.localStorage.setItem(`${OPTIONAL_SKIP_PREFIX}${orgSlug}`, '1');
    const progress = {};
    PROVIDER_WIZARD_STEPS.forEach((s) => {
      progress[s] = true;
    });
    writeProgress(orgSlug, progress);
  } catch {
    /* ignore */
  }
}

export function providerSetupPath(orgSlug, step = 'contact') {
  const base = `${providerHome(orgSlug)}/setup`;
  if (!step || step === 'contact') return base;
  return `${base}?step=${step}`;
}

export function providerOptionalSetupPath(orgSlug) {
  return providerResumeSetupPath(orgSlug);
}

export function nextProviderWizardStep(current) {
  const idx = PROVIDER_WIZARD_STEPS.indexOf(current);
  if (idx < 0 || idx >= PROVIDER_WIZARD_STEPS.length - 1) return null;
  return PROVIDER_WIZARD_STEPS[idx + 1];
}
