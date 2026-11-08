import {
  PROVIDER_WIZARD_STEPS,
  hasFinishedProviderSetupWizard,
  isProviderWizardStepDone,
  markProviderSetupWizardDone,
  markProviderWizardStepDoneExact,
  providerSetupPath,
} from './profileSetup';
import {
  providerServices,
  providerSettings,
  providerShare,
} from './providerPaths';

/**
 * Infer which setup steps are already satisfied from live org data
 * (not localStorage). Used so businesses that existed before the
 * guided checklist still get credit for work already done.
 */
export function inferProviderSetupSteps({
  org = null,
  servicesCount = null,
  schedulingMode = null,
  weeklyBlocksCount = null,
  openSlotsCount = null,
} = {}) {
  const mode = schedulingMode || org?.scheduling_mode || null;
  const blocks =
    weeklyBlocksCount != null
      ? Number(weeklyBlocksCount)
      : Array.isArray(org?.weekly_blocks)
        ? org.weekly_blocks.filter((b) => b?.is_active !== false).length
        : null;

  // Recurring needs weekly hours. Flexi counts as done once the business
  // is operating (services or open slots) — brand-new flexi orgs still nudge.
  const availabilityDone =
    (mode === 'recurring' && Number(blocks) > 0) ||
    (mode === 'flexi' &&
      ((typeof servicesCount === 'number' && servicesCount > 0) ||
        (typeof openSlotsCount === 'number' && openSlotsCount > 0)));

  const areaDone = Boolean(
    (org?.service_postal_code || '').trim() ||
      (org?.service_city || '').trim() ||
      (org?.service_latitude != null && org?.service_longitude != null) ||
      (Array.isArray(org?.locations) && org.locations.length > 0),
  );

  const servicesDone = typeof servicesCount === 'number' && servicesCount > 0;

  // profile_public alone is the default — require a real public touch.
  const profileDone = Boolean(
    (org?.tagline || '').trim() ||
      (org?.description || '').trim() ||
      org?.logo ||
      org?.banner ||
      org?.logo_url ||
      org?.banner_url,
  );

  const websiteDone = Boolean((org?.external_website_url || '').trim());

  return {
    availability: availabilityDone,
    service_area: areaDone,
    services: servicesDone,
    profile: profileDone,
    website: websiteDone,
  };
}

/**
 * Persist inferred completion into local wizard progress so Home, Settings,
 * Services, and the setup wizard all agree — including pre-guidance businesses.
 */
export function syncProviderSetupFromReality({
  orgSlug,
  org = null,
  servicesCount = null,
  schedulingMode = null,
  weeklyBlocksCount = null,
  openSlotsCount = null,
} = {}) {
  if (!orgSlug || hasFinishedProviderSetupWizard(orgSlug)) {
    return inferProviderSetupSteps({
      org,
      servicesCount,
      schedulingMode,
      weeklyBlocksCount,
      openSlotsCount,
    });
  }

  const inferred = inferProviderSetupSteps({
    org,
    servicesCount,
    schedulingMode,
    weeklyBlocksCount,
    openSlotsCount,
  });

  PROVIDER_WIZARD_STEPS.forEach((step) => {
    if (inferred[step] && !isProviderWizardStepDone(orgSlug, step)) {
      markProviderWizardStepDoneExact(orgSlug, step);
    }
  });

  const requiredDone = PROVIDER_WIZARD_STEPS.every(
    (step) => inferred[step] || isProviderWizardStepDone(orgSlug, step),
  );
  if (requiredDone) {
    markProviderSetupWizardDone(orgSlug);
  }

  return inferred;
}

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
  openSlotsCount = null,
} = {}) {
  if (!orgSlug) {
    return { items: [], doneCount: 0, total: 0, percent: 100, complete: true };
  }

  const inferred = syncProviderSetupFromReality({
    orgSlug,
    org,
    servicesCount,
    schedulingMode,
    weeklyBlocksCount,
    openSlotsCount,
  });

  if (hasFinishedProviderSetupWizard(orgSlug)) {
    return { items: [], doneCount: 0, total: 0, percent: 100, complete: true };
  }

  const availabilityDone =
    isProviderWizardStepDone(orgSlug, 'availability') || inferred.availability;
  const areaDone =
    isProviderWizardStepDone(orgSlug, 'service_area') || inferred.service_area;
  const servicesDone =
    isProviderWizardStepDone(orgSlug, 'services') || inferred.services;
  const profileDone =
    isProviderWizardStepDone(orgSlug, 'profile') || inferred.profile;
  const websiteDone = inferred.website;

  const items = [
    {
      id: 'availability',
      label: 'Availability',
      hint: availabilityDone
        ? 'Hours or open times are set'
        : 'Weekly hours or flexi open times',
      done: availabilityDone,
      to: `${providerSettings(orgSlug)}?section=availability`,
      setupTo: providerSetupPath(orgSlug, 'availability'),
    },
    {
      id: 'service_area',
      label: 'Service area',
      hint: areaDone
        ? 'Service area is set'
        : 'Where you work and how far you travel',
      done: areaDone,
      to: `${providerSettings(orgSlug)}?section=locations`,
      setupTo: providerSetupPath(orgSlug, 'service_area'),
    },
    {
      id: 'services',
      label: 'Services',
      hint: servicesDone
        ? 'Catalog has bookable services'
        : 'Add at least one bookable service',
      done: servicesDone,
      to: providerServices(orgSlug),
      setupTo: providerSetupPath(orgSlug, 'services'),
    },
    {
      id: 'profile',
      label: 'Public page',
      hint: profileDone
        ? 'Public page has your branding'
        : 'Photo, tagline, or about for customers',
      done: profileDone,
      to: providerShare(orgSlug),
      setupTo: providerSetupPath(orgSlug, 'profile'),
    },
    {
      id: 'website',
      label: 'Your website',
      hint: websiteDone ? 'Website link saved' : 'Optional link to your own site',
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
  const complete = doneCount >= total;

  if (complete) {
    markProviderSetupWizardDone(orgSlug);
  }

  return {
    items,
    doneCount,
    total,
    percent,
    complete,
  };
}
