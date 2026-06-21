import { useCallback, useState } from 'react';
import { businessesAPI } from '../utils/api';
import {
  buildAddressFromGeocode,
  canUseBrowserGeolocation,
  geolocationUnavailableReason,
  queryGeolocationPermission,
} from '../utils/geolocationSupport';

/**
 * Browser geolocation + reverse geocode via API.
 * Call fetchCurrentLocation from a button click so the permission popup can appear.
 */
export default function useCurrentLocation() {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const available = canUseBrowserGeolocation();

  const fetchCurrentLocation = useCallback(() => {
    const blocked = geolocationUnavailableReason();
    if (blocked) {
      setError(blocked);
      return Promise.resolve(null);
    }

    setLocating(true);
    setError(null);

    return queryGeolocationPermission().then((permission) => {
      if (permission === 'denied') {
        setLocating(false);
        setError(
          'Location is blocked for this site, so the browser will not show the allow popup. ' +
            'Click the lock icon in the address bar → Location → Allow, refresh the page, then try again.'
        );
        return null;
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const res = await businessesAPI.reverseGeocode({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
              const data = res.data || {};
              const address = buildAddressFromGeocode(data, {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
              const payload = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                address,
                city: data.city || '',
                state: data.state || data.province || '',
                postal_code: data.postal_code || '',
                country: data.country || '',
              };
              if (!address) {
                setError('Could not find an address for your location.');
                resolve(null);
              } else {
                resolve(payload);
              }
            } catch {
              setError('Could not resolve your location to an address.');
              resolve(null);
            } finally {
              setLocating(false);
            }
          },
          (err) => {
            setLocating(false);
            if (err.code === err.PERMISSION_DENIED) {
              setError(
                'Location permission was denied. To see the allow popup again: address bar lock icon → ' +
                  'Location → Allow (or Reset permission), then refresh and click this button once more.'
              );
            } else if (err.code === err.TIMEOUT) {
              setError('Location timed out. Try again or search your address.');
            } else {
              setError('Could not access your current location. Search your address instead.');
            }
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
        );
      });
    });
  }, []);

  return { locating, error, setError, available, fetchCurrentLocation };
}
