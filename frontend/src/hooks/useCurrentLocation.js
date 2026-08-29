import { useCallback, useState } from 'react';
import { businessesAPI } from '../utils/api';
import {
  LOCATION_ERROR,
  buildAddressFromGeocode,
  classifyLocationError,
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
  const [errorKind, setErrorKind] = useState(null);

  const fail = useCallback((message, kind) => {
    setError(message);
    setErrorKind(kind || null);
  }, []);

  // Keep kind in step with the message so callers clearing the error also clear the steps.
  const publicSetError = useCallback((next) => {
    setError(next);
    if (!next) setErrorKind(null);
  }, []);

  const fetchCurrentLocation = useCallback(() => {
    const blocked = geolocationUnavailableReason();
    if (blocked) {
      fail(blocked, LOCATION_ERROR.UNSUPPORTED);
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
            fail('Could not find an address for your location.', LOCATION_ERROR.OFF);
            return null;
          }
          setError(null);
          setErrorKind(null);
          return payload;
        } catch {
          fail('Could not resolve your location to an address.', LOCATION_ERROR.OFF);
          return null;
        }
      })
      .catch((err) => {
        const kind = classifyLocationError(err);
        if (kind === LOCATION_ERROR.BLOCKED) {
          fail(err?.message || locationPermissionDeniedMessage(), kind);
        } else if (kind === LOCATION_ERROR.TIMEOUT) {
          fail('Location timed out. Move to an open area or search your address.', kind);
        } else if (err?.message) {
          fail(err.message, kind);
        } else {
          fail('Could not access your current location. Search your address instead.', kind);
        }
        return null;
      })
      .finally(() => {
        setLocating(false);
      });
  }, [fail]);

  return { locating, error, errorKind, setError: publicSetError, fetchCurrentLocation };
}
