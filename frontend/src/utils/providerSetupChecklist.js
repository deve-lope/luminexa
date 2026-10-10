import {
  PROVIDER_WIZARD_STEPS,
  hasFinishedProviderSetupWizard,
  isProviderWizardStepDone,
  providerSetupPath,
} from './profileSetup';
import {
  providerServices,
  providerSettings,
  providerShare,
} from './providerPaths';

/**
 * Setup checklist for owners: real org signals + local wizard progress.
 * Used on Home and Settings (phone + desktop).
 */
export function buildProviderSetupChecklist({
  orgSlug,
  org = null,
  servicesCount = null,
  schedulingMode = null,
  weeklyBlocksCount = null,
} = {}) {
  if (!orgSlug) {
    return { items: [], doneCount: 0, total: 0, percent: 100, complete: true };
  }

  if (hasFinishedProviderSetupWizard(orgSlug)) {
    return { items: [], doneCount: 0, total: 0, percent: 100, complete: true };
  }

  const availabilityDone =
    isProviderWizardStepDone(orgSlug, 'availability') ||
    (schedulingMode === 'recurring' && Number(weeklyBlocksCount) > 0);

  const areaDone =
    isProviderWizardStepDone(orgSlug, 'service_area') ||
    Boolean(
      (org?.service_postal_code || '').trim() ||
        (org?.service_city || '').trim() ||
        (org?.service_latitude != null && org?.service_longitude != null) ||
        (Array.isArray(org?.locations) && org.locations.length > 0),
    );

  const servicesDone =
    isProviderWizardStepDone(orgSlug, 'services') ||
    (typeof servicesCount === 'number' && servicesCount > 0);

  const profileDone =
    isProviderWizardStepDone(orgSlug, 'profile') ||
    Boolean(
      (org?.tagline || '').trim() ||
        org?.logo ||
        org?.banner ||
        org?.profile_public === true,
    );

  const websiteDone = Boolean((org?.external_website_url || '').trim());

  const items = [
    {
      id: 'availability',
      label: 'Availability',
      hint: 'Weekly hours or flexi open times',
      done: availabilityDone,
      to: `${providerSettings(orgSlug)}?section=availability`,
      setupTo: providerSetupPath(orgSlug, 'availability'),
    },
    {
      id: 'service_area',
      label: 'Service area',
      hint: 'Where you work and how far you travel',
      done: areaDone,
      to: `${providerSettings(orgSlug)}?section=locations`,
      setupTo: providerSetupPath(orgSlug, 'service_area'),
    },
    {
      id: 'services',
      label: 'Services',
      hint: 'Add at least one bookable service',
      done: servicesDone,
      to: providerServices(orgSlug),
      setupTo: providerSetupPath(orgSlug, 'services'),
    },
    {
      id: 'profile',
      label: 'Public page',
      hint: 'Photo, tagline, or about for customers',
      done: profileDone,
      to: providerShare(orgSlug),
      setupTo: providerSetupPath(orgSlug, 'profile'),
    },
    {
      id: 'website',
      label: 'Your website',
      hint: 'Optional link to your own site',
      done: websiteDone,
      optional: true,
      to: `${providerSettings(orgSlug)}?section=website`,
      setupTo: `${providerSettings(orgSlug)}?section=website`,
    },
  ];

  const required = items.filter((i) => !i.optional);
  const doneCount = required.filter((i) => i.done).length;
  const total = required.length || PROVIDER_WIZARD_STEPS.length;
  const percent = total ? Math.round((doneCount / total) * 100) : 100;

  return {
    items,
    doneCount,
    total,
    percent,
    complete: doneCount >= total,
  };
}
