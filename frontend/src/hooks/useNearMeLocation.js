import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_RADIUS_MILES } from '../constants/locationSearch';
import {
  LOCATION_ERROR,
  canUseBrowserGeolocation,
  geolocationUnavailableReason,
  queryGeolocationPermission,
} from '../utils/geolocationSupport';
import useCurrentLocation from './useCurrentLocation';

export const NEAR_ME_STORAGE_KEY = 'luminexa.nearMeLocation';

function normalizeStored(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const radius = Number(raw.radiusMiles);
  return {
    lat,
    lng,
    label: (raw.label || '').trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    postal: (raw.postal || '').trim(),
    country: (raw.country || '').trim(),
    radiusMiles: Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_RADIUS_MILES,
  };
}

export function readNearMeLocation() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(NEAR_ME_STORAGE_KEY);
    if (!raw) return null;
    return normalizeStored(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeNearMeLocation(payload) {
  if (typeof window === 'undefined') return;
  const next = normalizeStored(payload);
  if (!next) return;
  try {
    window.localStorage.setItem(NEAR_ME_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function clearNearMeLocationStorage() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(NEAR_ME_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Persistable “near me” location for Find / browse.
 * Call requestNearMe from a tap handler so the browser can show the permission prompt.
 *
 * status: idle | prompting | ready | denied | unavailable
 */
export default function useNearMeLocation({ defaultRadiusMiles = DEFAULT_RADIUS_MILES } = {}) {
  const [status, setStatus] = useState('idle');
  const [location, setLocation] = useState(null);
  const { locating, error, errorKind, setError, fetchCurrentLocation } = useCurrentLocation();
  const requestRef = useRef(null);

  useEffect(() => {
    const saved = readNearMeLocation();
    if (saved) {
      setLocation(saved);
      setStatus('ready');
    }
  }, []);

  const applyLocation = useCallback(
    (payload) => {
      const next = normalizeStored({
        ...payload,
        radiusMiles:
          payload?.radiusMiles != null ? payload.radiusMiles : defaultRadiusMiles,
      });
      if (!next) return null;
      setLocation(next);
      writeNearMeLocation(next);
      setStatus('ready');
      setError(null);
      return next;
    },
    [defaultRadiusMiles, setError]
  );

  const clearLocation = useCallback(() => {
    setLocation(null);
    clearNearMeLocationStorage();
    setStatus('idle');
    setError(null);
  }, [setError]);

  const requestNearMe = useCallback(() => {
    if (!canUseBrowserGeolocation()) {
      const reason = geolocationUnavailableReason() || 'Location is not available.';
      setStatus('unavailable');
      setError(reason);
      return Promise.resolve(null);
    }

    setStatus('prompting');

    return fetchCurrentLocation().then((payload) => {
      if (!payload) {
        // useCurrentLocation already set a user-facing error string.
        setStatus((prev) => {
          // Keep ready if we already had a saved location.
          if (prev === 'ready' && location) return 'ready';
          return 'denied';
        });
        return null;
      }
      return applyLocation({
        lat: payload.lat,
        lng: payload.lng,
        label: payload.address,
        postal: payload.postal_code || '',
        country: payload.country || '',
        radiusMiles: location?.radiusMiles ?? defaultRadiusMiles,
      });
    });
  }, [
    applyLocation,
    defaultRadiusMiles,
    fetchCurrentLocation,
    location,
    setError,
  ]);

  useEffect(() => {
    requestRef.current = requestNearMe;
  }, [requestNearMe]);

  /**
   * A blocked permission never re-prompts, so the user has to fix it in device
   * settings. Native apps pick the location up the moment you come back — do the
   * same: on return, if the OS now says granted, retry without another tap.
   */
  useEffect(() => {
    if (status !== 'denied' || errorKind === LOCATION_ERROR.APP_OUTDATED) return undefined;

    let cancelled = false;
    const recheck = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      queryGeolocationPermission().then((state) => {
        if (cancelled || state !== 'granted') return;
        requestRef.current?.();
      });
    };

    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, [status, errorKind]);

  return {
    status,
    location,
    locating: locating || status === 'prompting',
    error,
    errorKind,
    setError,
    requestNearMe,
    applyLocation,
    clearLocation,
  };
}
