import React, { useState } from 'react';
import { businessesAPI } from '../../utils/api';
import { DEFAULT_RADIUS_MILES, RADIUS_MILE_OPTIONS } from '../../constants/locationSearch';
import SearchableRegionInput from '../ui/SearchableRegionInput';

function formatPostalInput(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '');
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

  const useNearMe = () => {
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
          if (data.postal_code) onPostalChange(formatPostalInput(data.postal_code));
          if (data.city) onCityChange(data.city);
          if (data.state || data.province) onStateChange(data.state || data.province);
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
          disabled={locating}
          className="text-xs font-medium text-luminexa-accent disabled:opacity-50"
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
            onChange={onStateChange}
            extraOptions={states}
            placeholder="Type province or state…"
          />
        </div>

        <div>
          <label htmlFor="filter-city" className="mb-1 block text-xs font-medium text-slate-600">
            City / place
          </label>
          <input
            id="filter-city"
            type="text"
            list="filter-city-options"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="e.g. Ottawa"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
          />
          {cities.length > 0 && (
            <datalist id="filter-city-options">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="filter-postal" className="mb-1 block text-xs font-medium text-slate-600">
              PIN / postal code
            </label>
            <input
              id="filter-postal"
              type="text"
              inputMode="text"
              autoComplete="postal-code"
              list="filter-postal-options"
              value={postal}
              onChange={(e) => onPostalChange(formatPostalInput(e.target.value))}
              placeholder="e.g. K1A0B1 or 78701"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
            {postalCodes.length > 0 && (
              <datalist id="filter-postal-options">
                {postalCodes.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
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
          Pick province and city first, then add PIN for distance search (within selected miles).
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
