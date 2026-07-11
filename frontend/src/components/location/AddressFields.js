import React, { useCallback } from 'react';
import usePostalLookup from '../../hooks/usePostalLookup';
import AddressSearchField from './AddressSearchField';
import SearchableRegionInput from '../ui/SearchableRegionInput';

/**
 * Shared postal + city + state + optional street fields with address search and postal lookup.
 */
export default function AddressFields({
  postalCode,
  onPostalCodeChange,
  city,
  onCityChange,
  state,
  onStateChange,
  address = '',
  onAddressChange,
  showStreet = true,
  postalLabel = 'PIN / postal code',
  cityLabel = 'City',
  stateLabel = 'Province / state',
  streetLabel = 'Street address',
  className = '',
  inputClassName = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm',
  dark = false,
}) {
  const handlePostalResolved = useCallback(
    ({ city: c, state: s }) => {
      if (c) onCityChange(c);
      if (s) onStateChange(s);
    },
    [onCityChange, onStateChange]
  );

  const postalLookup = usePostalLookup(postalCode, { onResolved: handlePostalResolved });

  const labelClass = dark
    ? 'mb-1 block text-sm font-medium text-luminexa-mist'
    : 'mb-1 block text-sm font-medium text-slate-700';
  const hintClass = dark ? 'text-xs text-luminexa-mist/60' : 'text-xs text-slate-500';
  const inputCls = dark
    ? 'w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-3 py-2.5 text-sm text-luminexa-mist outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent'
    : inputClassName;

  const applyLocationPayload = (payload) => {
    if (payload.postal_code) {
      onPostalCodeChange(payload.postal_code.replace(/[\s-]+/g, '').toUpperCase());
    }
    if (payload.city) onCityChange(payload.city);
    if (payload.state) onStateChange(payload.state);
    if (payload.address && onAddressChange) onAddressChange(payload.address);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <AddressSearchField
        id="addr-search"
        label="Search your address"
        placeholder="Start typing your street or area…"
        dark={dark}
        onSelect={applyLocationPayload}
      />

      <div>
        <label htmlFor="addr-state" className={labelClass}>
          {stateLabel}
        </label>
        <SearchableRegionInput
          id="addr-state"
          value={state}
          onChange={onStateChange}
          inputClassName={inputCls}
          placeholder="Type province or state…"
        />
      </div>

      <div>
        <label htmlFor="addr-city" className={labelClass}>
          {cityLabel}
        </label>
        <input
          id="addr-city"
          type="text"
          autoComplete="address-level2"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          className={inputCls}
          placeholder="City / place"
        />
      </div>

      <div>
        <label htmlFor="addr-postal" className={labelClass}>
          {postalLabel}
        </label>
        <input
          id="addr-postal"
          type="text"
          autoComplete="postal-code"
          value={postalCode}
          onChange={(e) =>
            onPostalCodeChange(e.target.value.toUpperCase().replace(/[\s-]+/g, ''))
          }
          className={inputCls}
          placeholder="e.g. K1A0B1"
        />
        <button
          type="button"
          onClick={postalLookup.lookupNow}
          disabled={!postalLookup.canLookup || postalLookup.status === 'loading'}
          className={`mt-2 min-h-[40px] rounded-lg border px-3 text-sm font-medium disabled:opacity-50 ${
            dark
              ? 'border-white/10 text-luminexa-mist'
              : 'border-slate-200 text-slate-700'
          }`}
        >
          {postalLookup.status === 'loading' ? 'Looking up…' : 'Fill city from PIN'}
        </button>
        {postalLookup.message && (
          <p
            className={`mt-1 text-xs ${
              postalLookup.status === 'success'
                ? dark
                  ? 'text-emerald-300'
                  : 'text-emerald-700'
                : hintClass
            }`}
          >
            {postalLookup.message}
          </p>
        )}
      </div>

      {showStreet && onAddressChange && (
        <div>
          <label htmlFor="addr-street" className={labelClass}>
            {streetLabel}
          </label>
          <textarea
            id="addr-street"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            rows={2}
            className={inputCls}
            placeholder="Street, area, or full address"
          />
        </div>
      )}
    </div>
  );
}
