import React, { useCallback } from 'react';
import usePostalLookup from '../../hooks/usePostalLookup';
import useCurrentLocation from '../../hooks/useCurrentLocation';
import useGeolocationPermission from '../../hooks/useGeolocationPermission';
import AddressSearchField from './AddressSearchField';
import MapLocationPicker from '../customer/MapLocationPicker';
import SearchableRegionInput from '../ui/SearchableRegionInput';
import {
  canUseBrowserGeolocation,
  geolocationPermissionHint,
  geolocationUnavailableReason,
} from '../../utils/geolocationSupport';

/**
 * Shared postal + city + state + optional street fields with auto lookup and map picker.
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
  showMapPicker = true,
  postalLabel = 'PIN / postal code',
  cityLabel = 'City',
  stateLabel = 'Province / state',
  streetLabel = 'Street address',
  className = '',
  inputClassName = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm',
  dark = false,
}) {
  const [mapOpen, setMapOpen] = React.useState(false);
  const gpsAvailable = canUseBrowserGeolocation();
  const gpsBlockedReason = geolocationUnavailableReason();
  const permission = useGeolocationPermission();
  const permissionHint = geolocationPermissionHint(permission);
  const { locating, error: locError, setError: setLocError, fetchCurrentLocation } =
    useCurrentLocation();

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

  const handleMapSelect = (payload) => {
    applyLocationPayload(payload);
    setMapOpen(false);
  };

  const handleUseCurrentLocation = async () => {
    setLocError(null);
    const result = await fetchCurrentLocation();
    if (!result) return;
    applyLocationPayload(result);
  };

  const applyLocationPayload = (payload) => {
    if (payload.postal_code) {
      onPostalCodeChange(payload.postal_code.replace(/[\s-]+/g, '').toUpperCase());
    }
    if (payload.city) onCityChange(payload.city);
    if (payload.state) onStateChange(payload.state);
    if (payload.address && onAddressChange) onAddressChange(payload.address);
  };

  const permissionBlocked =
    locError && /permission|blocked|allow/i.test(locError);

  return (
    <div className={`space-y-3 ${className}`}>
      <AddressSearchField
        id="addr-search"
        label="Search your address"
        placeholder="Start typing your street or area…"
        dark={dark}
        onSelect={applyLocationPayload}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        {gpsAvailable ? (
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 ${
              dark
                ? 'border-violet-400/40 bg-violet-500/20 text-luminexa-accent'
                : 'border-violet-200 bg-violet-50 text-luminexa-accent'
            }`}
          >
            {locating ? 'Getting your location…' : 'Use my current location'}
          </button>
        ) : null}
        {showMapPicker && (
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm font-medium ${
              dark ? 'border-white/10 text-luminexa-mist' : 'border-slate-200 text-slate-700'
            }`}
          >
            Pick on map
          </button>
        )}
      </div>
      {!gpsAvailable && gpsBlockedReason && (
        <p className={`text-xs ${dark ? 'text-luminexa-mist/70' : 'text-slate-500'}`}>
          {gpsBlockedReason}
        </p>
      )}
      {gpsAvailable && permissionHint && !locError && (
        <p className={`text-xs ${dark ? 'text-luminexa-mist/70' : 'text-slate-500'}`}>
          {permissionHint}
        </p>
      )}
      {locError && gpsAvailable && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            dark ? 'bg-amber-500/10 text-amber-200' : 'bg-amber-50 text-amber-800'
          }`}
        >
          <p>{locError}</p>
          {permissionBlocked && (
            <p className={`mt-2 ${dark ? 'text-amber-100/90' : 'text-amber-900/80'}`}>
              To allow location: click the lock or site icon in your browser&apos;s address bar →
              Location → Allow, then try again. Or use <strong>Search your address</strong> or{' '}
              <strong>Pick on map</strong> below.
            </p>
          )}
        </div>
      )}
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

      {showMapPicker && (
        <MapLocationPicker
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          onSelect={handleMapSelect}
        />
      )}
    </div>
  );
}
