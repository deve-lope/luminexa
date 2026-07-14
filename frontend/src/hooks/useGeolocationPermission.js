import { useEffect, useState } from 'react';
import { queryGeolocationPermission } from '../utils/geolocationSupport';

/**
 * Tracks browser geolocation permission: granted | denied | prompt | unsupported | unknown
 */
export default function useGeolocationPermission() {
  const [permission, setPermission] = useState('unknown');

  useEffect(() => {
    let cancelled = false;
    let permissionStatus = null;

    queryGeolocationPermission().then((state) => {
      if (!cancelled) setPermission(state);
    });

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          permissionStatus = status;
          if (!cancelled) setPermission(status.state);
          status.onchange = () => {
            if (!cancelled) setPermission(status.state);
          };
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, []);

  return permission;
}
