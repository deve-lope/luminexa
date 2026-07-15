import { DEFAULT_RADIUS_MILES, formatRadiusMiles } from '../constants/locationSearch';

export function formatProviderServiceArea(org) {
  if (!org) return '';
  const locs = Array.isArray(org.locations)
    ? org.locations.filter((l) => l.is_active !== false)
    : [];
  if (locs.length > 1) {
    const places = locs.slice(0, 3).map((loc) => {
      return (
        [loc.city, loc.state].filter(Boolean).join(', ') ||
        loc.postal_code ||
        loc.name ||
        ''
      );
    }).filter(Boolean);
    const more = locs.length - places.length;
    const joined = places.join(', ') + (more > 0 ? ` +${more} more` : '');
    return joined ? `${locs.length} locations · ${joined}` : `${locs.length} service locations`;
  }

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
  if (Array.isArray(org.locations) && org.locations.some((l) => l.is_active !== false)) {
    return true;
  }
  return Boolean(
    (org.service_latitude != null && org.service_longitude != null) ||
      org.service_postal_code?.trim() ||
      org.service_city?.trim() ||
      org.service_address?.trim()
  );
}
