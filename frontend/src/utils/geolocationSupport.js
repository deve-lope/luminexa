/**
 * Browser geolocation only works in a secure context (HTTPS or localhost).
 * On http://192.168.x.x it is blocked by the browser.
 */
export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function hasGeolocationApi() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

export function canUseBrowserGeolocation() {
  return (
    typeof window !== 'undefined' &&
    hasGeolocationApi() &&
    window.isSecureContext
  );
}

export function geolocationUnavailableReason() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'Location is not available in this browser.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    if (isMobileDevice()) {
      return 'Sharing your location needs HTTPS. Open the site with https://, or search your address below.';
    }
    return 'Current location needs HTTPS or localhost. Search your address below or pick a point on the map.';
  }
  return null;
}

export function geolocationRequestOptions({ highAccuracy } = {}) {
  const mobile = isMobileDevice();
  const accurate = highAccuracy ?? mobile;
  return {
    enableHighAccuracy: accurate,
    timeout: mobile ? 30000 : 20000,
    maximumAge: accurate ? 0 : 60000,
  };
}

/**
 * Request GPS coordinates. Call directly from a tap/click handler — do not await
 * Permissions API first or mobile browsers may block the prompt.
 */
export function requestGeolocationCoordinates() {
  return new Promise((resolve, reject) => {
    if (!canUseBrowserGeolocation()) {
      reject(new Error(geolocationUnavailableReason() || 'Geolocation unavailable'));
      return;
    }

    const onError = (err, triedFallback) => {
      if (!triedFallback && err?.code === 3 && isMobileDevice()) {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          geolocationRequestOptions({ highAccuracy: false })
        );
        return;
      }
      reject(err);
    };

    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => onError(err, false),
      geolocationRequestOptions({ highAccuracy: true })
    );
  });
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

export function formatLocationAddress(payload = {}) {
  const direct = (payload.address || '').trim();
  if (direct) return direct;
  const parts = [
    payload.city,
    payload.state || payload.province,
    payload.postal_code,
    payload.country,
  ].filter(Boolean);
  if (parts.length) return parts.join(', ');
  if (payload.lat != null && payload.lng != null) {
    return `${Number(payload.lat).toFixed(5)}, ${Number(payload.lng).toFixed(5)}`;
  }
  return '';
}

export function shareLocationButtonLabel({ locating = false } = {}) {
  if (locating) return 'Getting your address…';
  return isMobileDevice() ? 'Share my location' : 'Use my current location';
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
    if (isMobileDevice()) {
      return 'Tap “Share my location” — your phone will ask to allow access, then we fill in your address.';
    }
    return 'Click “Use my current location” — your browser should ask to allow access.';
  }
  if (state === 'denied') {
    if (isMobileDevice()) {
      return 'Location was blocked. Open your browser site settings → Location → Allow, then try again.';
    }
    return 'Location was blocked earlier, so the browser will not show the popup again. Click the lock icon in the address bar → Location → Allow, then refresh and try again.';
  }
  if (state === 'unsupported') {
    return geolocationUnavailableReason() || 'Current location is not available in this browser.';
  }
  return '';
}
