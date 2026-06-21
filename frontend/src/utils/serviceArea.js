import { DEFAULT_RADIUS_MILES, formatRadiusMiles } from '../constants/locationSearch';

export function formatProviderServiceArea(org) {
  if (!org) return '';
  const radiusMiles = Number(org.service_radius_miles) || DEFAULT_RADIUS_MILES;
  const radiusLabel = formatRadiusMiles(radiusMiles);
  const place =
    [org.service_city, org.service_state].filter(Boolean).join(', ') ||
    org.service_address ||
    org.service_postal_code ||
    '';
  if (place) {
    return `Serves within ${radiusLabel} of ${place}`;
  }
  if (org.service_latitude != null && org.service_longitude != null) {
    return `Serves within ${radiusLabel} of your map pin`;
  }
  return '';
}

export function providerHasServiceArea(org) {
  if (!org) return false;
  return Boolean(
    (org.service_latitude != null && org.service_longitude != null) ||
      org.service_postal_code?.trim() ||
      org.service_city?.trim() ||
      org.service_address?.trim()
  );
}
