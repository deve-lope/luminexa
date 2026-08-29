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

/** Why location failed. Drives which recovery steps we show. */
export const LOCATION_ERROR = {
  BLOCKED: 'blocked',
  OFF: 'off',
  TIMEOUT: 'timeout',
  UNSUPPORTED: 'unsupported',
  APP_OUTDATED: 'app-outdated',
};

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
    // Blocked means the OS will not ask again — settings is the only way back.
    return 'Luminexa does not have permission to use your location. Allow it in your device settings, then come back.';
  }
  if (isMobileDevice()) {
    return 'Location was blocked for this site. Allow it in your browser settings, then try again.';
  }
  return 'Location was blocked. Allow location when your browser asks, then try again.';
}

export function locationServicesOffMessage() {
  if (runningInNativeApp()) {
    // Android can re-offer its system dialog on the next attempt; iOS cannot.
    return isIOSUserAgent(typeof navigator === 'undefined' ? '' : navigator.userAgent)
      ? 'Location Services is turned off on your iPhone. Turn it on in Settings, then come back.'
      : 'Location is turned off on your phone. Tap Try again, then choose OK when your phone asks to turn it on.';
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

/**
 * @returns {'ios-app'|'android-app'|'ios-web'|'android-web'|'desktop-web'}
 */
export function locationPlatform() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const ios = isIOSUserAgent(ua);
  const android = /Android/i.test(ua);
  if (runningInNativeApp()) return ios ? 'ios-app' : 'android-app';
  if (ios) return 'ios-web';
  if (android) return 'android-web';
  return 'desktop-web';
}

export function isIOSUserAgent(ua = '') {
  return /iPad|iPhone|iPod/i.test(ua);
}

export function classifyLocationError(err) {
  if (!err) return null;
  if (err.kind) return err.kind;
  if (err.nativeUnavailable) return LOCATION_ERROR.APP_OUTDATED;
  if (err.code === 1 || err.code === '1') return LOCATION_ERROR.BLOCKED;
  if (err.code === 3 || err.code === '3') return LOCATION_ERROR.TIMEOUT;
  return LOCATION_ERROR.OFF;
}

/**
 * Step-by-step recovery for the device in hand — the OS will not re-ask once a
 * user has blocked location, so these mirror what native apps link you to.
 */
export function locationSettingsSteps(kind = LOCATION_ERROR.BLOCKED) {
  const platform = locationPlatform();
  const deviceOff = kind === LOCATION_ERROR.OFF;

  if (platform === 'ios-app') {
    return deviceOff
      ? [
        'Open Settings on your iPhone.',
        'Tap Privacy & Security → Location Services and turn it on.',
        'Come back to Luminexa — we retry on our own.',
      ]
      : [
        'Open Settings on your iPhone.',
        'Tap Privacy & Security → Location Services → Luminexa.',
        'Choose While Using the App.',
        'Come back to Luminexa — we retry on our own.',
      ];
  }

  if (platform === 'android-app') {
    return deviceOff
      ? [
        'Swipe down from the top and tap the Location tile to turn it on.',
        'Come back to Luminexa — we retry on our own.',
      ]
      : [
        'Open Settings → Apps → Luminexa → Permissions.',
        'Tap Location → Allow only while using the app.',
        'Check the Location tile in Quick Settings is on.',
        'Come back to Luminexa — we retry on our own.',
      ];
  }

  if (platform === 'ios-web') {
    return [
      'Open Settings → Privacy & Security → Location Services and turn it on.',
      'Scroll down to Safari Websites → While Using the App.',
      'Reload this page, then tap Share my location.',
    ];
  }

  if (platform === 'android-web') {
    return [
      'Tap the lock or ⓘ icon beside the address bar.',
      'Tap Permissions → Location → Allow.',
      'Check the Location tile in Quick Settings is on.',
    ];
  }

  return [
    'Click the icon on the left of the address bar.',
    'Set Location to Allow.',
    'Reload the page, then try again.',
  ];
}

export function locationErrorTitle(kind) {
  if (kind === LOCATION_ERROR.OFF) return 'Location is turned off';
  if (kind === LOCATION_ERROR.TIMEOUT) return 'Could not get a fix';
  if (kind === LOCATION_ERROR.APP_OUTDATED) return 'Update needed for GPS';
  if (kind === LOCATION_ERROR.UNSUPPORTED) return 'Location not available here';
  return 'Location is blocked for Luminexa';
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

function outdatedAppError() {
  return geoError(1, nativeGpsUnavailableMessage(), {
    nativeUnavailable: true,
    kind: LOCATION_ERROR.APP_OUTDATED,
  });
}

function blockedError() {
  return geoError(1, locationPermissionDeniedMessage(), { kind: LOCATION_ERROR.BLOCKED });
}

/**
 * @capacitor/geolocation rejects with code "OS-PLUG-GLOC-0007" style strings on
 * both platforms. Codes are shared; 0009 and 0014-0018 are Android only.
 */
const NATIVE_ERROR_KINDS = {
  '0002': LOCATION_ERROR.OFF, // position unavailable
  '0003': LOCATION_ERROR.BLOCKED, // permission denied
  '0004': LOCATION_ERROR.OFF, // bad arguments
  '0005': LOCATION_ERROR.OFF,
  '0006': LOCATION_ERROR.OFF,
  '0007': LOCATION_ERROR.OFF, // location services disabled
  '0008': LOCATION_ERROR.BLOCKED, // restricted (parental controls / MDM)
  '0009': LOCATION_ERROR.OFF, // declined the system "Turn on location" dialog
  '0010': LOCATION_ERROR.TIMEOUT,
  '0014': LOCATION_ERROR.OFF, // Play Services resolvable
  '0015': LOCATION_ERROR.OFF, // Play Services error
  '0016': LOCATION_ERROR.OFF, // location settings error
  '0017': LOCATION_ERROR.OFF, // network + location both off
  '0018': LOCATION_ERROR.APP_OUTDATED, // manifest permissions missing
};

function nativeErrorKind(err) {
  const match = /OS-PLUG-GLOC-(\d{4})/.exec(String(err?.code || ''));
  if (match) return NATIVE_ERROR_KINDS[match[1]] || LOCATION_ERROR.OFF;
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('denied') || msg.includes('permission')) return LOCATION_ERROR.BLOCKED;
  if (msg.includes('timeout') || msg.includes('in time')) return LOCATION_ERROR.TIMEOUT;
  return LOCATION_ERROR.OFF;
}

function mapNativeGeoError(err) {
  const kind = nativeErrorKind(err);
  if (kind === LOCATION_ERROR.BLOCKED) return blockedError();
  if (kind === LOCATION_ERROR.TIMEOUT) {
    return geoError(3, 'Location timed out. Move to an open area or search your address.', {
      kind,
    });
  }
  if (kind === LOCATION_ERROR.APP_OUTDATED) return outdatedAppError();
  return geoError(2, locationServicesOffMessage(), { kind });
}

async function nativeGetCurrentPosition() {
  let Geolocation;
  try {
    ({ Geolocation } = await import('@capacitor/geolocation'));
  } catch (err) {
    throw outdatedAppError();
  }
  try {
    // getCurrentPosition drives the whole native flow on its own: it requests the
    // runtime permission, and on Android it shows the Play Services "Turn on
    // location" dialog when device location is off. Do NOT gate it behind
    // checkPermissions/requestPermissions — those reject outright when location
    // services are off, which suppressed that dialog and looked like a dead button.
    return await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 30000,
    });
  } catch (err) {
    if (isNativePluginMissing(err)) throw outdatedAppError();
    throw mapNativeGeoError(err);
  }
}

/**
 * True when we can deep-link to the OS screen that fixes this.
 * The SPA is served live to the app, so an installed build can be older than
 * this code — ask the native runtime whether NativeSettings is actually compiled
 * in, otherwise the button would do nothing on those versions.
 */
export function canOpenLocationSettings() {
  if (!runningInNativeApp()) return false;
  try {
    return !!window.Capacitor?.isPluginAvailable?.('NativeSettings');
  } catch {
    return false;
  }
}

/**
 * Open the OS screen for the failure in hand. Android can go straight to the
 * location sources screen; on iOS Apple only sanctions the app's own settings
 * page, so never deep-link Location Services there (App Store rejection risk).
 */
export async function openLocationSettings(kind = LOCATION_ERROR.BLOCKED) {
  if (!runningInNativeApp()) return false;
  try {
    const { NativeSettings, AndroidSettings, IOSSettings } = await import(
      'capacitor-native-settings'
    );
    await NativeSettings.open({
      optionAndroid:
        kind === LOCATION_ERROR.OFF ? AndroidSettings.Location : AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
    return true;
  } catch {
    return false;
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
      reject(
        geoError(2, geolocationUnavailableReason() || 'Geolocation unavailable', {
          kind: LOCATION_ERROR.UNSUPPORTED,
        })
      );
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
  if (!err) return geoError(2, locationServicesOffMessage(), { kind: LOCATION_ERROR.OFF });
  if (err.code === 1) {
    return geoError(1, locationPermissionDeniedMessage(), { kind: LOCATION_ERROR.BLOCKED });
  }
  if (err.code === 3) {
    return geoError(3, 'Location timed out. Move to an open area or search your address.', {
      kind: LOCATION_ERROR.TIMEOUT,
    });
  }
  return geoError(err.code || 2, err.message || locationServicesOffMessage(), {
    kind: LOCATION_ERROR.OFF,
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
