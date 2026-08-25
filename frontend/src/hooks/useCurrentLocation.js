import { useCallback, useState } from 'react';
import { businessesAPI } from '../utils/api';
import {
  buildAddressFromGeocode,
  formatLocationAddress,
  geolocationUnavailableReason,
  locationPermissionDeniedMessage,
  requestGeolocationCoordinates,
} from '../utils/geolocationSupport';

/**
 * Browser geolocation + reverse geocode via API.
 * Call fetchCurrentLocation from a button click so the permission popup can appear.
 */
export default function useCurrentLocation() {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  const fetchCurrentLocation = useCallback(() => {
    const blocked = geolocationUnavailableReason();
    if (blocked) {
      setError(blocked);
      return Promise.resolve(null);
    }

    setLocating(true);

    // Keep the prompt on screen while we ask the phone — clearing error makes it flicker.

    // getCurrentPosition must run in the same turn as the user tap — no permission pre-check.
    return requestGeolocationCoordinates()
      .then(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await businessesAPI.reverseGeocode({ lat, lng });
          const data = res.data || {};
          const payload = {
            lat,
            lng,
            address: buildAddressFromGeocode(data, { lat, lng }),
            city: data.city || '',
            state: data.state || data.province || '',
            postal_code: data.postal_code || '',
            country: data.country || '',
          };
          payload.address = formatLocationAddress(payload);
          if (!payload.address) {
            setError('Could not find an address for your location.');
            return null;
          }
          return payload;
        } catch {
          setError('Could not resolve your location to an address.');
          return null;
        }
      })
        .catch((err) => {
        if (err?.nativeUnavailable) {
          setError(err.message);
        } else if (err?.code === 1) {
          setError(err.message || locationPermissionDeniedMessage());
        } else if (err?.code === 3) {
          setError('Location timed out. Move to an open area or search your address.');
        } else if (err?.message) {
          setError(err.message);
        } else {
          setError('Could not access your current location. Search your address instead.');
        }
        return null;
      })
      .finally(() => {
        setLocating(false);
      });
  }, []);

  return { locating, error, setError, fetchCurrentLocation };
}
