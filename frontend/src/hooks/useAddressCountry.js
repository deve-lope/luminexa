import { useCallback, useEffect, useState } from 'react';
import {
  ADDRESS_COUNTRY_STORAGE_KEY,
  SUPPORTED_ADDRESS_COUNTRIES,
  countryFromNavigator,
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

function resolveInitialCountry(initialCountry) {
  const profile = normalizeAddressCountry(initialCountry);
  if (profile) return profile;
  const locale = countryFromNavigator();
  const stored = readStoredCountry();
  if (isManualSelection() && stored) return stored;
  if (locale && stored && locale !== stored) return locale;
  if (stored) return stored;
  if (locale) return locale;
  return defaultAddressCountry();
}

/**
 * Address country for geocoding filters.
 * Priority: profile / initialCountry → manual session choice → browser locale → server guess.
 * Server detection never overrides a profile or manual selection.
 */
export default function useAddressCountry({ initialCountry } = {}) {
  const [country, setCountryState] = useState(() => resolveInitialCountry(initialCountry));
  const [source, setSource] = useState(() => {
    if (normalizeAddressCountry(initialCountry)) return 'profile';
    if (isManualSelection()) return 'manual';
    if (readStoredCountry()) return 'stored';
    return 'locale';
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

    if (isManualSelection() && readStoredCountry()) {
      setCountryState(readStoredCountry());
      setSource('manual');
      setLoading(false);
      return undefined;
    }

    const stored = readStoredCountry();
    const locale = countryFromNavigator();
    if (stored && locale && locale !== stored && !isManualSelection()) {
      setCountryState(locale);
      setSource('locale');
      writeStoredCountry(locale);
      setLoading(false);
      return undefined;
    }

    if (stored) {
      setCountryState(stored);
      setSource('stored');
      setLoading(false);
      return undefined;
    }

    if (locale) {
      setCountryState(locale);
      setSource('locale');
      writeStoredCountry(locale);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    fetchDetectedCountry()
      .then(({ country: detected, source: detectedSource }) => {
        if (cancelled || !detected || !isSupportedAddressCountry(detected)) return;
        setCountryState(detected);
        setSource(detectedSource || 'server');
        writeStoredCountry(detected);
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
