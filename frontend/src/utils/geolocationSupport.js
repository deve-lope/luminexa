/**
 * Browser geolocation only works in a secure context (HTTPS or localhost).
 * On http://192.168.x.x it is blocked by the browser.
 */
export function canUseBrowserGeolocation() {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.geolocation &&
    window.isSecureContext
  );
}

export function geolocationUnavailableReason() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'Location is not available in this browser.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Current location needs HTTPS or localhost. Search your address below or pick a point on the map.';
  }
  return null;
}

export function buildAddressFromGeocode(data, { lat, lng } = {}) {
  const display = (data?.display_name || '').trim();
  if (display) return display;
  const parts = [
    data?.city,
    data?.state || data?.province,
    data?.postal_code,
  ].filter(Boolean);
  if (parts.length) return parts.join(', ');
  if (lat != null && lng != null) {
    return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  }
  return '';
}

/**
 * @returns {'granted'|'denied'|'prompt'|'unsupported'|'unknown'}
 */
export async function queryGeolocationPermission() {
  if (!canUseBrowserGeolocation()) return 'unsupported';
  if (!navigator.permissions?.query) return 'unknown';
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return 'unknown';
  }
}

export function geolocationPermissionHint(state) {
  if (state === 'prompt' || state === 'unknown') {
    return 'Click “Use my current location” — your browser should ask to allow access.';
  }
  if (state === 'denied') {
    return 'Location was blocked earlier, so the browser will not show the popup again. Click the lock icon in the address bar → Location → Allow, then refresh and try again.';
  }
  if (state === 'unsupported') {
    return geolocationUnavailableReason() || 'Current location is not available in this browser.';
  }
  return '';
}
