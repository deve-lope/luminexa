/**
 * Browser geolocation only works in a secure context (HTTPS or localhost).
 * On http://192.168.x.x it is blocked by the browser.
 * In the Capacitor app, use the native Geolocation plugin so Android/iOS
 * can show the system “Allow location” / “Turn on location” prompt.
 */

export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function runningInNativeApp() {
  try {
    return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export function hasGeolocationApi() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

export function canUseBrowserGeolocation() {
  if (runningInNativeApp()) return true;
  return (
    typeof window !== 'undefined' &&
    hasGeolocationApi() &&
    window.isSecureContext
  );
}

export function geolocationUnavailableReason() {
  if (runningInNativeApp()) return null;
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'Location is not available on this device.';
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

export function locationPermissionDeniedMessage() {
  if (runningInNativeApp()) {
    return 'Turn on location for Luminexa. When your phone asks, tap Allow.';
  }
  if (isMobileDevice()) {
    return 'Location was blocked. Allow location when your phone asks, or turn it on in site settings.';
  }
  return 'Location was blocked. Allow location when your browser asks, then try again.';
}

export function locationServicesOffMessage() {
  if (runningInNativeApp()) {
    return 'Location is turned off on your phone. Turn it on, then tap Share my location again.';
  }
  return 'Could not read your location. Turn on Location on your device, then try again.';
}

export function isLocationPermissionDenied(err) {
  if (!err) return false;
  if (err.code === 1 || err.code === '1') return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes('denied') || msg.includes('permission');
}

function geoError(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

function isNativePluginMissing(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    err?.code === 'UNIMPLEMENTED' ||
    msg.includes('not implemented') ||
    msg.includes('plugin is not implemented')
  );
}

function nativeGpsUnavailableMessage() {
  return 'This app version cannot use GPS yet. Tap Enter address, or install the latest Luminexa update from Play Store.';
}

async function nativeGetCurrentPosition() {
  let Geolocation;
  try {
    ({ Geolocation } = await import('@capacitor/geolocation'));
  } catch (err) {
    throw geoError(1, nativeGpsUnavailableMessage(), { nativeUnavailable: true });
  }
  let perm;
  try {
    perm = await Geolocation.checkPermissions();
  } catch (err) {
    if (isNativePluginMissing(err)) {
      throw geoError(1, nativeGpsUnavailableMessage(), { nativeUnavailable: true });
    }
    perm = { location: 'prompt' };
  }
  if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
    try {
      perm = await Geolocation.requestPermissions();
    } catch (err) {
      if (isNativePluginMissing(err)) {
        throw geoError(1, nativeGpsUnavailableMessage(), { nativeUnavailable: true });
      }
      throw geoError(1, locationPermissionDeniedMessage());
    }
  }
  const granted = perm.location === 'granted' || perm.coarseLocation === 'granted';
  if (!granted) {
    throw geoError(1, locationPermissionDeniedMessage());
  }
  try {
    return await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 30000,
    });
  } catch (err) {
    if (isNativePluginMissing(err)) {
      throw geoError(1, nativeGpsUnavailableMessage(), { nativeUnavailable: true });
    }
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('denied') || msg.includes('permission')) {
      throw geoError(1, locationPermissionDeniedMessage());
    }
    if (msg.includes('timeout')) {
      throw geoError(3, 'Location timed out. Move to an open area or search your address.');
    }
    throw geoError(2, locationServicesOffMessage());
  }
}

/**
 * Request GPS coordinates. Call directly from a tap/click handler.
 * Native app uses the Capacitor plugin (system Allow / Turn on location prompt).
 * Do not fall back to web geolocation in the app — that fails instantly and flickers.
 */
export function requestGeolocationCoordinates() {
  if (runningInNativeApp()) {
    return nativeGetCurrentPosition();
  }
  return webGetCurrentPosition();
}

function webGetCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!canUseBrowserGeolocation()) {
      reject(geoError(2, geolocationUnavailableReason() || 'Geolocation unavailable'));
      return;
    }

    const onError = (err, triedFallback) => {
      if (!triedFallback && err?.code === 3 && isMobileDevice()) {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (fallbackErr) => reject(mapWebGeoError(fallbackErr)),
          geolocationRequestOptions({ highAccuracy: false })
        );
        return;
      }
      reject(mapWebGeoError(err));
    };

    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => onError(err, false),
      geolocationRequestOptions({ highAccuracy: true })
    );
  });
}

function mapWebGeoError(err) {
  if (!err) return geoError(2, locationServicesOffMessage());
  if (err.code === 1) return geoError(1, locationPermissionDeniedMessage());
  if (err.code === 3) {
    return geoError(3, 'Location timed out. Move to an open area or search your address.');
  }
  if (err.code === 2) return geoError(2, locationServicesOffMessage());
  return geoError(err.code || 2, err.message || locationServicesOffMessage());
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
  return isMobileDevice() || runningInNativeApp() ? 'Share my location' : 'Use my current location';
}

/**
 * @returns {'granted'|'denied'|'prompt'|'unsupported'|'unknown'}
 */
export async function queryGeolocationPermission() {
  if (!canUseBrowserGeolocation()) return 'unsupported';
  if (runningInNativeApp()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'granted' || perm.coarseLocation === 'granted') return 'granted';
      if (perm.location === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unknown';
    }
  }
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
    if (runningInNativeApp() || isMobileDevice()) {
      return 'Tap “Share my location” — your phone will ask to allow access, then we fill in your address.';
    }
    return 'Click “Use my current location” — your browser should ask to allow access.';
  }
  if (state === 'denied') {
    return locationPermissionDeniedMessage();
  }
  if (state === 'unsupported') {
    return geolocationUnavailableReason() || 'Current location is not available on this device.';
  }
  return '';
}
