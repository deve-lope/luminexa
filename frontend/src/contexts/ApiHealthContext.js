import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api, { registerApiHealthHandler } from '../utils/api';

const ApiHealthContext = createContext({
  connectionStatus: 'ok',
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

function isGatewayDown(error) {
  const status = error?.response?.status;
  return status === 502 || status === 503 || status === 504;
}

function isTransientNetworkError(error) {
  if (!error || error.response || isCanceledRequest(error)) return false;
  if (isSoftLocationRequest(error)) return false;
  return true;
}

function isConnectivityProblem(error) {
  return isGatewayDown(error) || isTransientNetworkError(error);
}

/** Show a spinner this long before switching to the can't-connect screen. */
const CONNECTING_GRACE_MS = 10000;

export function ApiHealthProvider({ children }) {
  const [connectionStatus, setConnectionStatus] = useState('ok');
  const statusRef = useRef('ok');
  const graceTimerRef = useRef(null);

  const setStatus = useCallback((next) => {
    statusRef.current = next;
    setConnectionStatus(next);
  }, []);

  const clearGraceTimer = useCallback(() => {
    if (graceTimerRef.current) {
      window.clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }, []);

  const clearMaintenance = useCallback(() => {
    clearGraceTimer();
    setStatus('ok');
  }, [clearGraceTimer, setStatus]);

  const beginConnecting = useCallback(() => {
    if (statusRef.current === 'down') return;
    if (statusRef.current === 'ok') {
      setStatus('connecting');
    }
    if (!graceTimerRef.current) {
      graceTimerRef.current = window.setTimeout(() => {
        graceTimerRef.current = null;
        if (statusRef.current === 'connecting') {
          setStatus('down');
        }
      }, CONNECTING_GRACE_MS);
    }
  }, [setStatus]);

  useEffect(() => {
    return registerApiHealthHandler((error) => {
      if (!error) {
        clearMaintenance();
        return;
      }
      if (isConnectivityProblem(error)) {
        beginConnecting();
      }
    });
  }, [beginConnecting, clearMaintenance]);

  const retry = useCallback(async () => {
    try {
      const res = await api.get('/accounts/api/session/', {
        timeout: 8000,
        validateStatus: () => true,
      });
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        beginConnecting();
        return false;
      }
      clearMaintenance();
      return true;
    } catch (e) {
      if (isConnectivityProblem(e)) {
        beginConnecting();
        return false;
      }
      clearMaintenance();
      return true;
    }
  }, [beginConnecting, clearMaintenance]);

  useEffect(() => {
    if (connectionStatus === 'ok') return undefined;
    const onResume = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      retry();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') onResume();
    };
    const poll = window.setInterval(onResume, 3000);
    window.addEventListener('online', onResume);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('online', onResume);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [connectionStatus, retry]);

  useEffect(() => () => clearGraceTimer(), [clearGraceTimer]);

  const value = useMemo(
    () => ({
      connectionStatus,
      underMaintenance: connectionStatus === 'down',
      clearMaintenance,
      retry,
    }),
    [connectionStatus, clearMaintenance, retry],
  );

  return <ApiHealthContext.Provider value={value}>{children}</ApiHealthContext.Provider>;
}

export function useApiHealth() {
  return useContext(ApiHealthContext);
}
