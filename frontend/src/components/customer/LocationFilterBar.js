import React, { useEffect, useState } from 'react';
import { businessesAPI } from '../../utils/api';
import { DEFAULT_RADIUS_MILES, RADIUS_MILE_OPTIONS } from '../../constants/locationSearch';
import SearchableOptionInput from '../ui/SearchableOptionInput';
import SearchableRegionInput from '../ui/SearchableRegionInput';
import { canUseBrowserGeolocation, geolocationUnavailableReason } from '../../utils/geolocationSupport';

function formatPostalInput(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

/** Display Canadian postal codes as A1A 1A1; leave US ZIPs as-is. */
function formatPostalLabel(code) {
  const raw = formatPostalInput(code);
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(raw)) {
    return `${raw.slice(0, 3)} ${raw.slice(3)}`;
  }
  return raw;
}

export default function LocationFilterBar({
  postal = '',
  radiusMiles = DEFAULT_RADIUS_MILES,
  city = '',
  state = '',
  postalCodes = [],
  cities = [],
  states = [],
  onPostalChange,
  onRadiusChange,
  onCityChange,
  onStateChange,
  onClear,
}) {
  const hasFilter = Boolean(postal?.trim() || city?.trim() || state?.trim());
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);
  const [localCities, setLocalCities] = useState(cities);
  const [localPostalCodes, setLocalPostalCodes] = useState(postalCodes);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [manualPostal, setManualPostal] = useState(false);
  const stateSelected = Boolean(state?.trim());

  useEffect(() => {
    setLocalCities(cities);
    setLocalPostalCodes(postalCodes);
  }, [cities, postalCodes]);

  useEffect(() => {
    if (!stateSelected) {
      setLocalCities([]);
      setLocalPostalCodes([]);
      setOptionsLoading(false);
      setManualPostal(false);
      return undefined;
    }
    let cancelled = false;
    setOptionsLoading(true);
    const timer = setTimeout(() => {
      businessesAPI
        .locationOptions({ state: state.trim(), city: city.trim() })
        .then((res) => {
          if (cancelled) return;
          const data = res.data || {};
          setLocalCities(Array.isArray(data.cities) ? data.cities : []);
          setLocalPostalCodes(Array.isArray(data.postal_codes) ? data.postal_codes : []);
        })
        .catch(() => {
          if (!cancelled) {
            setLocalCities(cities);
            setLocalPostalCodes(postalCodes);
          }
        })
        .finally(() => {
          if (!cancelled) setOptionsLoading(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state, city, stateSelected, cities, postalCodes]);

  const handleStateChange = (nextState) => {
    onStateChange(nextState);
    onCityChange('');
    onPostalChange('');
    setManualPostal(false);
  };

  const handleCityChange = (nextCity) => {
    onCityChange(nextCity);
    setManualPostal(false);
    if (postal && localPostalCodes.length > 0) {
      const normalized = formatPostalInput(postal);
      const match = localPostalCodes.some((code) => formatPostalInput(code) === normalized);
      if (!match) onPostalChange('');
    }
  };

  const postalInList =
    !postal ||
    localPostalCodes.some((code) => formatPostalInput(code) === formatPostalInput(postal));
  const showPostalSelect =
    stateSelected && !manualPostal && localPostalCodes.length > 0 && (postalInList || !postal);

  const gpsAvailable = canUseBrowserGeolocation();
  const gpsBlockedReason = geolocationUnavailableReason();

  const useNearMe = () => {
    if (!gpsAvailable) {
      setLocError(
        gpsBlockedReason ||
          'Current location is not available. Pick province, city, and PIN instead.'
      );
      return;
    }
    if (!navigator.geolocation) {
      setLocError('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await businessesAPI.reverseGeocode({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          const data = res.data || {};
          if (data.state || data.province) onStateChange(data.state || data.province);
          if (data.city) onCityChange(data.city);
          if (data.postal_code) onPostalChange(formatPostalInput(data.postal_code));
        } catch {
          setLocError('Could not resolve your location.');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setLocError('Allow location access or enter your postal code manually.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Search near you
        </p>
        <button
          type="button"
          onClick={useNearMe}
          disabled={locating || !gpsAvailable}
          title={!gpsAvailable ? gpsBlockedReason || '' : undefined}
          className="text-xs font-medium text-luminexa-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {locating ? 'Locating…' : 'Near me'}
        </button>
      </div>
      {locError && <p className="mb-2 text-xs text-amber-700">{locError}</p>}
      <div className="space-y-2">
        <div>
          <label htmlFor="filter-state" className="mb-1 block text-xs font-medium text-slate-600">
            Province / state
          </label>
          <SearchableRegionInput
            id="filter-state"
            value={state}
            onChange={handleStateChange}
            extraOptions={states}
            placeholder="Type province or state…"
          />
        </div>

        <div>
          <label htmlFor="filter-city" className="mb-1 block text-xs font-medium text-slate-600">
            City / place
          </label>
          <SearchableOptionInput
            id="filter-city"
            value={city}
            onChange={handleCityChange}
            options={stateSelected ? localCities : []}
            disabled={!stateSelected}
            placeholder={stateSelected ? 'Pick or type a city…' : 'Select province / state first'}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="filter-postal" className="mb-1 block text-xs font-medium text-slate-600">
              PIN / postal code
            </label>
            {optionsLoading ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                Loading codes for {state}…
              </p>
            ) : showPostalSelect ? (
              <>
                <select
                  id="filter-postal"
                  value={postal}
                  onChange={(e) => onPostalChange(formatPostalInput(e.target.value))}
                  className={`w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent ${
                    postal ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <option value="" disabled={Boolean(postal)}>
                    {city?.trim()
                      ? `Select PIN in ${city}…`
                      : `Select PIN in ${state}…`}
                  </option>
                  {localPostalCodes.map((code) => (
                    <option key={code} value={code}>
                      {formatPostalLabel(code)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setManualPostal(true)}
                  className="mt-1 text-xs font-medium text-luminexa-accent"
                >
                  Type a code not listed
                </button>
              </>
            ) : (
              <>
                <SearchableOptionInput
                  id="filter-postal"
                  value={postal}
                  onChange={(v) => onPostalChange(formatPostalInput(v))}
                  options={stateSelected ? localPostalCodes : []}
                  disabled={!stateSelected}
                  placeholder={
                    stateSelected
                      ? localPostalCodes.length
                        ? 'Pick from list or type PIN…'
                        : 'Type PIN / postal code…'
                      : 'Select province / state first'
                  }
                />
                {stateSelected && localPostalCodes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualPostal(false);
                      if (postal && !postalInList) onPostalChange('');
                    }}
                    className="mt-1 text-xs font-medium text-luminexa-accent"
                  >
                    Pick from list ({localPostalCodes.length})
                  </button>
                )}
              </>
            )}
          </div>
          <div>
            <label htmlFor="filter-radius" className="mb-1 block text-xs font-medium text-slate-600">
              Within
            </label>
            <select
              id="filter-radius"
              value={radiusMiles}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              disabled={!postal?.trim()}
              className="w-full min-w-[7.5rem] rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent disabled:bg-slate-50 disabled:text-slate-400"
            >
              {RADIUS_MILE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          {stateSelected
            ? city?.trim()
              ? `${localPostalCodes.length} PIN / postal code${
                  localPostalCodes.length === 1 ? '' : 's'
                } in ${city} — pick one, then choose distance.`
              : `Pick a city to narrow PIN codes, or choose from all codes in ${state}.`
            : 'Pick province or state first — cities and PIN / postal codes are filtered to that area.'}
        </p>
      </div>
      {hasFilter && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 text-sm font-medium text-luminexa-accent"
        >
          Clear area filters
        </button>
      )}
    </div>
  );
}
