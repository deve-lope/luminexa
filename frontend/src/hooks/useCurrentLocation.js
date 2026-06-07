import { useCallback, useState } from 'react';
import { businessesAPI } from '../utils/api';

/**
 * Browser geolocation + reverse geocode via API.
 * @returns {{ locating: boolean, error: string|null, fetchCurrentLocation: () => Promise<object|null> }}
 */
export default function useCurrentLocation() {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  const fetchCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const msg = 'Location is not available in this browser.';
      setError(msg);
      return Promise.resolve(null);
    }

    setLocating(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await businessesAPI.reverseGeocode({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
            const data = res.data || {};
            const payload = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              address: data.display_name || '',
              city: data.city || '',
              state: data.state || data.province || '',
              postal_code: data.postal_code || '',
              country: data.country || '',
            };
            if (!payload.address) {
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
            setError('Allow location access in your browser, or enter the address manually.');
          } else if (err.code === err.TIMEOUT) {
            setError('Location timed out. Try again or enter your address manually.');
          } else {
            setError('Could not access your current location.');
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  return { locating, error, setError, fetchCurrentLocation };
}
