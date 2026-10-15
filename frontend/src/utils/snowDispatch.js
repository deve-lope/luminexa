/** Snow route dispatch — org mode helpers (docs/SNOW_ROUTE_DISPATCH.md). */

export function isSnowRoutesOrg(membershipOrOrg) {
  if (!membershipOrOrg) return false;
  return membershipOrOrg.provider_mode === 'property_routes';
}

export function isSnowOwnerNav(membership) {
  if (!membership || membership.role === 'crew') return false;
  return isSnowRoutesOrg(membership);
}

export const CONTRACT_STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'expiring', label: 'Expiring' },
  { id: 'expired', label: 'Expired' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'unpaid', label: 'Unpaid' },
];

export const RUN_STATUS_LABEL = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function formatPropertyAddress(p) {
  if (!p) return '';
  const parts = [
    p.service_line1,
    p.service_line2,
    [p.service_city, p.service_region].filter(Boolean).join(', '),
    p.service_postal,
  ].filter(Boolean);
  return parts.join('\n');
}

export function mapsDestinationFromStop(stop) {
  if (stop?.latitude != null && stop?.longitude != null) {
    return `${stop.latitude},${stop.longitude}`;
  }
  return formatPropertyAddress(stop);
}
