/** Provider dashboard URLs include the business slug. */

export function providerHome(orgSlug) {
  return `/provider/${orgSlug}`;
}

export function providerSchedule(orgSlug) {
  return `/provider/${orgSlug}/schedule`;
}

export function providerScheduleDetail(orgSlug, kind, id) {
  return `/provider/${orgSlug}/schedule/${kind}/${id}`;
}

export function providerSettings(orgSlug) {
  return `/provider/${orgSlug}/settings`;
}

export function providerShare(orgSlug) {
  return `/provider/${orgSlug}/my-page`;
}

export function providerNotifications(orgSlug) {
  return `/provider/${orgSlug}/notifications`;
}

export function providerServices(orgSlug) {
  return `/provider/${orgSlug}/services`;
}

export function providerTasks(orgSlug) {
  return `/provider/${orgSlug}/tasks`;
}

export function providerAddTask(orgSlug, jobId) {
  const base = `/provider/${orgSlug}/tasks/new`;
  return jobId ? `${base}?job=${jobId}` : base;
}

export function firstProviderHome(memberships) {
  const org = (memberships || []).find((m) => m.role === 'owner' || m.role === 'staff');
  return org ? providerHome(org.organization_slug) : '/provider';
}
