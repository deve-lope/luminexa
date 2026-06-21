import React, { useState } from 'react';
import AddressSearchField from '../location/AddressSearchField';
import MapLocationPicker from './MapLocationPicker';
import useCurrentLocation from '../../hooks/useCurrentLocation';
import useGeolocationPermission from '../../hooks/useGeolocationPermission';
import { canUseBrowserGeolocation, geolocationPermissionHint, geolocationUnavailableReason } from '../../utils/geolocationSupport';

/**
 * Service location with search, optional GPS, map picker, and address field.
 */
export default function ServiceLocationInput({
  value,
  onChange,
  label = 'Service location',
  required = false,
  hint = 'Street, city, postcode — where should they come?',
  id = 'service-address',
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const gpsAvailable = canUseBrowserGeolocation();
  const gpsBlockedReason = geolocationUnavailableReason();
  const permission = useGeolocationPermission();
  const permissionHint = geolocationPermissionHint(permission);
  const { locating, error: locError, setError: setLocError, fetchCurrentLocation } =
    useCurrentLocation();

  const handleUseCurrentLocation = async () => {
    setLocError(null);
    const result = await fetchCurrentLocation();
    if (result?.address) {
      onChange(result.address);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>

      <AddressSearchField
        id={`${id}-search`}
        label="Search your address"
        placeholder="Start typing your street or area…"
        onSelect={(item) => onChange(item.address || value)}
        className="mb-3"
      />

      <div className="mb-2 flex flex-col gap-2 sm:flex-row">
        {gpsAvailable ? (
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="min-h-[44px] flex-1 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-medium text-luminexa-accent disabled:opacity-60"
          >
            {locating ? 'Getting your location…' : 'Use my current location'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className={`min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 ${
            gpsAvailable ? 'flex-1' : 'w-full'
          }`}
        >
          Pick on map
        </button>
      </div>
      {!gpsAvailable && gpsBlockedReason && (
        <p className="mb-2 text-xs text-slate-500">{gpsBlockedReason}</p>
      )}
      {gpsAvailable && permissionHint && !locError && (
        <p className="mb-2 text-xs text-slate-500">{permissionHint}</p>
      )}
      {locError && gpsAvailable && <p className="mb-2 text-xs text-amber-700">{locError}</p>}
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
        rows={2}
        required={required}
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
      />
      <MapLocationPicker
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        onSelect={({ address }) => {
          onChange(address);
          setMapOpen(false);
        }}
      />
    </div>
  );
}
