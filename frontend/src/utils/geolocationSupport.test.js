import {
  LOCATION_ERROR,
  canOpenLocationSettings,
  classifyLocationError,
  locationErrorTitle,
  locationPlatform,
  locationServicesOffMessage,
  locationSettingsSteps,
  requestGeolocationCoordinates,
} from './geolocationSupport';

function setUserAgent(ua) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
}

const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Chrome/120';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari';

describe('classifyLocationError', () => {
  it('reads an explicit kind first', () => {
    expect(classifyLocationError({ kind: LOCATION_ERROR.TIMEOUT })).toBe(LOCATION_ERROR.TIMEOUT);
  });

  it('treats a missing native plugin as an outdated app', () => {
    expect(classifyLocationError({ code: 1, nativeUnavailable: true })).toBe(
      LOCATION_ERROR.APP_OUTDATED
    );
  });

  it('maps geolocation error codes', () => {
    expect(classifyLocationError({ code: 1 })).toBe(LOCATION_ERROR.BLOCKED);
    expect(classifyLocationError({ code: 2 })).toBe(LOCATION_ERROR.OFF);
    expect(classifyLocationError({ code: 3 })).toBe(LOCATION_ERROR.TIMEOUT);
  });

  it('returns null with no error', () => {
    expect(classifyLocationError(null)).toBeNull();
  });
});

describe('locationPlatform', () => {
  afterEach(() => {
    delete window.Capacitor;
    setUserAgent(DESKTOP_UA);
  });

  it('detects the native Android app', () => {
    setUserAgent(ANDROID_UA);
    window.Capacitor = { isNativePlatform: () => true };
    expect(locationPlatform()).toBe('android-app');
  });

  it('detects the native iOS app', () => {
    setUserAgent(IPHONE_UA);
    window.Capacitor = { isNativePlatform: () => true };
    expect(locationPlatform()).toBe('ios-app');
  });

  it('detects mobile browsers separately from the app', () => {
    setUserAgent(ANDROID_UA);
    expect(locationPlatform()).toBe('android-web');
    setUserAgent(IPHONE_UA);
    expect(locationPlatform()).toBe('ios-web');
  });

  it('falls back to desktop web', () => {
    setUserAgent(DESKTOP_UA);
    expect(locationPlatform()).toBe('desktop-web');
  });
});

describe('locationSettingsSteps', () => {
  afterEach(() => {
    delete window.Capacitor;
    setUserAgent(DESKTOP_UA);
  });

  it('sends the Android app user to app permissions', () => {
    setUserAgent(ANDROID_UA);
    window.Capacitor = { isNativePlatform: () => true };
    const steps = locationSettingsSteps(LOCATION_ERROR.BLOCKED).join(' ');
    expect(steps).toMatch(/Apps → Luminexa → Permissions/);
  });

  it('sends the iOS app user to Location Services', () => {
    setUserAgent(IPHONE_UA);
    window.Capacitor = { isNativePlatform: () => true };
    const steps = locationSettingsSteps(LOCATION_ERROR.BLOCKED).join(' ');
    expect(steps).toMatch(/Location Services → Luminexa/);
  });

  it('points at the device toggle when location services are off', () => {
    setUserAgent(ANDROID_UA);
    window.Capacitor = { isNativePlatform: () => true };
    const steps = locationSettingsSteps(LOCATION_ERROR.OFF).join(' ');
    expect(steps).toMatch(/Location tile/);
    expect(steps).not.toMatch(/Permissions/);
  });

  it('points browser users at the address bar controls', () => {
    setUserAgent(ANDROID_UA);
    expect(locationSettingsSteps(LOCATION_ERROR.BLOCKED).join(' ')).toMatch(/address bar/);
  });

  it('always returns actionable steps', () => {
    Object.values(LOCATION_ERROR).forEach((kind) => {
      expect(locationSettingsSteps(kind).length).toBeGreaterThan(0);
    });
  });
});

describe('locationErrorTitle', () => {
  it('separates blocked from turned off', () => {
    expect(locationErrorTitle(LOCATION_ERROR.BLOCKED)).toMatch(/blocked/i);
    expect(locationErrorTitle(LOCATION_ERROR.OFF)).toMatch(/turned off/i);
  });
});

describe('canOpenLocationSettings', () => {
  afterEach(() => {
    delete window.Capacitor;
  });

  it('is unavailable outside the native app', () => {
    expect(canOpenLocationSettings()).toBe(false);
  });

  it('stays hidden on app builds shipped before the plugin', () => {
    // The app loads the live SPA, so an installed build can predate this code.
    window.Capacitor = {
      isNativePlatform: () => true,
      isPluginAvailable: () => false,
    };
    expect(canOpenLocationSettings()).toBe(false);
  });

  it('is available once the plugin is compiled in', () => {
    window.Capacitor = {
      isNativePlatform: () => true,
      isPluginAvailable: (name) => name === 'NativeSettings',
    };
    expect(canOpenLocationSettings()).toBe(true);
  });
});

describe('native geolocation', () => {
  const getCurrentPosition = jest.fn();
  const checkPermissions = jest.fn();
  const requestPermissions = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    getCurrentPosition.mockReset();
    checkPermissions.mockReset();
    requestPermissions.mockReset();
    jest.doMock('@capacitor/geolocation', () => ({
      Geolocation: { getCurrentPosition, checkPermissions, requestPermissions },
    }));
    setUserAgent(ANDROID_UA);
    window.Capacitor = { isNativePlatform: () => true };
  });

  afterEach(() => {
    jest.dontMock('@capacitor/geolocation');
    delete window.Capacitor;
    setUserAgent(DESKTOP_UA);
  });

  async function loadRequest() {
    const mod = await import('./geolocationSupport');
    return mod.requestGeolocationCoordinates;
  }

  it('asks the plugin for a position without gating on permission checks', async () => {
    // checkPermissions rejects while device location is off, which used to stop us
    // from ever reaching the system "Turn on location" dialog.
    getCurrentPosition.mockResolvedValue({ coords: { latitude: 1, longitude: 2 } });
    const request = await loadRequest();

    const pos = await request();

    expect(pos.coords.latitude).toBe(1);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(checkPermissions).not.toHaveBeenCalled();
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('reports location services off, not a blocked permission', async () => {
    getCurrentPosition.mockRejectedValue({
      code: 'OS-PLUG-GLOC-0007',
      message: 'Location services are not enabled.',
    });
    const request = await loadRequest();

    await expect(request()).rejects.toMatchObject({ kind: LOCATION_ERROR.OFF });
  });

  it('reports a declined system turn-on dialog as off', async () => {
    getCurrentPosition.mockRejectedValue({ code: 'OS-PLUG-GLOC-0009' });
    const request = await loadRequest();

    await expect(request()).rejects.toMatchObject({ kind: LOCATION_ERROR.OFF });
  });

  it('reports a denied permission as blocked', async () => {
    getCurrentPosition.mockRejectedValue({ code: 'OS-PLUG-GLOC-0003' });
    const request = await loadRequest();

    await expect(request()).rejects.toMatchObject({ kind: LOCATION_ERROR.BLOCKED });
  });

  it('reports a timeout as a timeout', async () => {
    getCurrentPosition.mockRejectedValue({ code: 'OS-PLUG-GLOC-0010' });
    const request = await loadRequest();

    await expect(request()).rejects.toMatchObject({ kind: LOCATION_ERROR.TIMEOUT });
  });

  it('treats missing manifest permissions as an outdated build', async () => {
    getCurrentPosition.mockRejectedValue({ code: 'OS-PLUG-GLOC-0018' });
    const request = await loadRequest();

    await expect(request()).rejects.toMatchObject({ kind: LOCATION_ERROR.APP_OUTDATED });
  });

  it('tells Android users the next tap re-offers the system dialog', () => {
    expect(locationServicesOffMessage()).toMatch(/Try again/);
  });

  it('does not promise iOS users a dialog that Apple never shows', () => {
    setUserAgent(IPHONE_UA);
    expect(locationServicesOffMessage()).toMatch(/Settings/);
    expect(locationServicesOffMessage()).not.toMatch(/Try again/);
  });
});

it('exposes a coordinate request entry point', () => {
  expect(typeof requestGeolocationCoordinates).toBe('function');
});
