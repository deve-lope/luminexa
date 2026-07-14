import { useCallback, useEffect, useState } from 'react';
import {
  ADDRESS_COUNTRY_STORAGE_KEY,
  SUPPORTED_ADDRESS_COUNTRIES,
  defaultAddressCountry,
  isSupportedAddressCountry,
  normalizeAddressCountry,
} from '../constants/addressCountries';
import { businessesAPI } from '../utils/api';

export const ADDRESS_COUNTRY_MANUAL_KEY = 'luminexa_address_country_manual';

function readStoredCountry() {
  try {
    return normalizeAddressCountry(sessionStorage.getItem(ADDRESS_COUNTRY_STORAGE_KEY));
  } catch {
    return '';
  }
}

function isManualSelection() {
  try {
    return sessionStorage.getItem(ADDRESS_COUNTRY_MANUAL_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStoredCountry(country, { manual = false } = {}) {
  try {
    if (country) {
      sessionStorage.setItem(ADDRESS_COUNTRY_STORAGE_KEY, country);
      if (manual) {
        sessionStorage.setItem(ADDRESS_COUNTRY_MANUAL_KEY, '1');
      } else {
        sessionStorage.removeItem(ADDRESS_COUNTRY_MANUAL_KEY);
      }
    } else {
      sessionStorage.removeItem(ADDRESS_COUNTRY_STORAGE_KEY);
      sessionStorage.removeItem(ADDRESS_COUNTRY_MANUAL_KEY);
    }
  } catch {
    /* ignore */
  }
}

let detectPromise = null;

function fetchDetectedCountry() {
  if (!detectPromise) {
    detectPromise = businessesAPI
      .detectAddressCountry()
      .then((res) => ({
        country: normalizeAddressCountry(res.data?.country),
        source: res.data?.source || '',
      }))
      .catch(() => ({ country: '', source: '' }))
      .finally(() => {
        detectPromise = null;
      });
  }
  return detectPromise;
}

/**
 * Address country for geocoding filters (Americas).
 * Priority: profile → manual choice → IP/Cloudflare detection → Canada.
 * Re-fetches network country every session load unless the user picked manually.
 */
export default function useAddressCountry({ initialCountry } = {}) {
  const [country, setCountryState] = useState(
    () => normalizeAddressCountry(initialCountry) || readStoredCountry() || defaultAddressCountry()
  );
  const [source, setSource] = useState(() => {
    if (normalizeAddressCountry(initialCountry)) return 'profile';
    if (isManualSelection()) return 'manual';
    if (readStoredCountry()) return 'stored';
    return 'default';
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const profileCountry = normalizeAddressCountry(initialCountry);
    if (profileCountry) {
      setCountryState(profileCountry);
      setSource('profile');
      writeStoredCountry(profileCountry, { manual: true });
      setLoading(false);
      return undefined;
    }

    // Manual override wins until the user clears it (new session / setCountry elsewhere).
    if (isManualSelection() && readStoredCountry()) {
      setCountryState(readStoredCountry());
      setSource('manual');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    fetchDetectedCountry()
      .then(({ country: detected, source: detectedSource }) => {
        if (cancelled) return;
        if (detected && isSupportedAddressCountry(detected)) {
          setCountryState(detected);
          setSource(detectedSource || 'server');
          writeStoredCountry(detected);
          return;
        }
        const fallback = defaultAddressCountry();
        setCountryState(fallback);
        setSource('default');
        writeStoredCountry(fallback);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialCountry]);

  const setCountry = useCallback((value) => {
    const next = normalizeAddressCountry(value);
    if (!next) return;
    setCountryState(next);
    setSource('manual');
    writeStoredCountry(next, { manual: true });
  }, []);

  return {
    country,
    source,
    loading,
    setCountry,
    supportedCountries: SUPPORTED_ADDRESS_COUNTRIES,
  };
}
