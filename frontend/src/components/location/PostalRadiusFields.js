import React, { useCallback, useEffect, useRef, useState } from 'react';
import AddressCountrySelect from './AddressCountrySelect';
import useAddressCountry from '../../hooks/useAddressCountry';
import { useAuth } from '../../contexts/AuthContext';
import { businessesAPI } from '../../utils/api';
import { DEFAULT_RADIUS_MILES, RADIUS_MILE_OPTIONS } from '../../constants/locationSearch';
import {
  formatPostalLabel,
  isPostalSearchReady,
  normalizePostalInput,
  validatePostalCode,
} from '../../utils/postalInput';

function locationLabelFromLookup(postal, data) {
  const city = data?.city || '';
  const region = data?.province || data?.state || '';
  const place = [city, region].filter(Boolean).join(', ');
  if (place) return `${formatPostalLabel(postal)} · ${place}`;
  return formatPostalLabel(postal);
}

/**
 * ZIP / postal code + radius — triggers onLocationReady when a valid code is entered.
 */
export default function PostalRadiusFields({
  postal = '',
  onPostalChange,
  radiusMiles = DEFAULT_RADIUS_MILES,
  onRadiusChange,
  onLocationReady,
  showCountry = true,
  idPrefix = 'postal-filter',
  disabled = false,
}) {
  const lookupSeq = useRef(0);
  const [postalTouched, setPostalTouched] = useState(false);
  const { user } = useAuth();
  const { country, setCountry } = useAddressCountry({ initialCountry: user?.address_country });

  const emitReady = useCallback(
    async (rawPostal, radius) => {
      const normalized = normalizePostalInput(rawPostal);
      if (!isPostalSearchReady(normalized)) return;

      const seq = ++lookupSeq.current;
      let data = null;
      try {
        const res = await businessesAPI.lookupPostalCode(normalized, country);
        data = res.data;
      } catch {
        data = null;
      }
      if (seq !== lookupSeq.current) return;

      onLocationReady?.({
        postal: normalized,
        radiusMiles: radius,
        lat: data?.latitude ?? null,
        lng: data?.longitude ?? null,
        label: locationLabelFromLookup(normalized, data),
        city: data?.city || '',
        state: data?.province || data?.state || '',
      });
    },
    [country, onLocationReady]
  );

  useEffect(() => {
    const normalized = normalizePostalInput(postal);
    if (!normalized || !isPostalSearchReady(normalized)) return undefined;
    const timer = window.setTimeout(() => {
      emitReady(normalized, radiusMiles);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [postal, radiusMiles, emitReady]);

  const handlePostalInput = (value) => {
    onPostalChange?.(normalizePostalInput(value));
  };

  const normalizedPostal = normalizePostalInput(postal);
  const postalCheck = validatePostalCode(normalizedPostal, { country, mode: 'search' });
  const showPostalError = postalTouched && normalizedPostal && !postalCheck.valid;

  const handleRadiusInput = (e) => {
    const next = Number(e.target.value);
    onRadiusChange?.(next);
    const normalized = normalizePostalInput(postal);
    if (isPostalSearchReady(normalized)) {
      emitReady(normalized, next);
    }
  };

  return (
    <div className="space-y-2">
      {showCountry && (
        <AddressCountrySelect
          id={`${idPrefix}-country`}
          value={country}
          onChange={setCountry}
        />
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor={`${idPrefix}-postal`} className="mb-1 block text-xs font-medium text-slate-600">
            ZIP / postal code
          </label>
          <input
            id={`${idPrefix}-postal`}
            type="text"
            inputMode="text"
            autoComplete="postal-code"
            disabled={disabled}
            value={formatPostalLabel(postal)}
            onChange={(e) => handlePostalInput(e.target.value)}
            onBlur={() => setPostalTouched(true)}
            placeholder="e.g. 90210 or M5V 2T6"
            aria-invalid={showPostalError}
            className={`w-full min-h-[44px] rounded-xl border px-4 text-sm outline-none focus:ring-1 disabled:bg-slate-50 ${
              showPostalError
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-200 focus:border-luminexa-accent focus:ring-luminexa-accent'
            }`}
          />
          {showPostalError && (
            <p className="mt-1 text-xs text-red-600">{postalCheck.error}</p>
          )}
        </div>
        <div>
          <label htmlFor={`${idPrefix}-radius`} className="mb-1 block text-xs font-medium text-slate-600">
            Within
          </label>
          <select
            id={`${idPrefix}-radius`}
            value={radiusMiles}
            onChange={handleRadiusInput}
            disabled={disabled || !isPostalSearchReady(postal)}
            className="w-full min-h-[44px] min-w-[7.5rem] rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-luminexa-accent disabled:bg-slate-50 disabled:text-slate-400"
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
        Enter your ZIP or postal code to see providers in that area.
      </p>
    </div>
  );
}
