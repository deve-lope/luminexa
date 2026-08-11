import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api, { registerApiHealthHandler } from '../utils/api';

const ApiHealthContext = createContext({
  underMaintenance: false,
  clearMaintenance: () => {},
  retry: async () => {},
});

function isCanceledRequest(error) {
  return (
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'CanceledError' ||
    error?.name === 'AbortError' ||
    error?.message === 'canceled'
  );
}

/** Soft location helpers — timeouts/aborts must not flip the whole app to maintenance. */
function isSoftLocationRequest(error) {
  const url = String(error?.config?.url || '');
  return (
    url.includes('map-search') ||
    url.includes('postal-lookup') ||
    url.includes('reverse-geocode') ||
    url.includes('location-options') ||
    url.includes('detect-country')
  );
}

function isServerUnreachable(error) {
  if (!error || isCanceledRequest(error)) return false;
  // Address search aborts/timeouts are expected while typing — keep the booking UI.
  if (isSoftLocationRequest(error) && !error.response) return false;
  if (!error.response) {
    // Network failure, CORS block, or timeout — treat as outage.
    return true;
  }
  const status = error.response.status;
  return status === 502 || status === 503 || status === 504;
}

export function ApiHealthProvider({ children }) {
  const [underMaintenance, setUnderMaintenance] = useState(false);

  const clearMaintenance = useCallback(() => {
    setUnderMaintenance(false);
  }, []);

  const reportUnreachable = useCallback(() => {
    setUnderMaintenance(true);
  }, []);

  useEffect(() => {
    return registerApiHealthHandler((error) => {
      if (isServerUnreachable(error)) {
        reportUnreachable();
      }
    });
  }, [reportUnreachable]);

  const retry = useCallback(async () => {
    try {
      // Lightweight probe that always hits Django.
      const res = await api.get('/accounts/api/profile/', {
        timeout: 8000,
        validateStatus: () => true,
      });
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        setUnderMaintenance(true);
        return false;
      }
      clearMaintenance();
      return true;
    } catch (e) {
      if (isServerUnreachable(e)) {
        setUnderMaintenance(true);
        return false;
      }
      // Got a real HTTP response path somehow — treat as recovered.
      clearMaintenance();
      return true;
    }
  }, [clearMaintenance]);

  const value = useMemo(
    () => ({ underMaintenance, clearMaintenance, retry }),
    [underMaintenance, clearMaintenance, retry],
  );

  return <ApiHealthContext.Provider value={value}>{children}</ApiHealthContext.Provider>;
}

export function useApiHealth() {
  return useContext(ApiHealthContext);
}
