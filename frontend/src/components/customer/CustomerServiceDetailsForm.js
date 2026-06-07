import React, { useState } from 'react';
import MapLocationPicker from './MapLocationPicker';
import useCurrentLocation from '../../hooks/useCurrentLocation';

/**
 * Shared fields: what service they need, where, and extra details.
 */
export default function CustomerServiceDetailsForm({
  serviceLabel,
  onServiceLabelChange,
  message,
  onMessageChange,
  serviceAddress,
  onServiceAddressChange,
  showServiceLabel = true,
  compact = false,
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const { locating, error: locError, setError: setLocError, fetchCurrentLocation } =
    useCurrentLocation();

  const handleUseCurrentLocation = async () => {
    setLocError(null);
    const result = await fetchCurrentLocation();
    if (result?.address) {
      onServiceAddressChange(result.address);
    }
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {showServiceLabel && (
        <div>
          <label htmlFor="service-label" className="mb-1 block text-sm font-medium text-slate-700">
            What type of service?
          </label>
          <input
            id="service-label"
            type="text"
            value={serviceLabel}
            onChange={(e) => onServiceLabelChange(e.target.value)}
            placeholder="e.g. Plumbing, Car wash interior, Electrical outlet"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
          />
        </div>
      )}
      <div>
        <label htmlFor="service-message" className="mb-1 block text-sm font-medium text-slate-700">
          Describe what you need
        </label>
        <textarea
          id="service-message"
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder="Be specific: e.g. fix kitchen sink leak, full interior detail, install new light fixture…"
          rows={compact ? 3 : 4}
          required
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
        />
        <p className="mt-1 text-xs text-slate-500">At least 10 characters so the business knows how to help.</p>
      </div>
      <div>
        <label htmlFor="service-address" className="mb-1 block text-sm font-medium text-slate-700">
          Service location
        </label>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="min-h-[44px] flex-1 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-medium text-luminexa-accent disabled:opacity-60"
          >
            {locating ? 'Getting your location…' : 'Use my current location'}
          </button>
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="min-h-[44px] flex-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700"
          >
            Pick on map
          </button>
        </div>
        {locError && <p className="mb-2 text-xs text-amber-700">{locError}</p>}
        <textarea
          id="service-address"
          value={serviceAddress}
          onChange={(e) => onServiceAddressChange(e.target.value)}
          placeholder="Street, city, postcode — where should they come?"
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
        />
      </div>
      <MapLocationPicker
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        onSelect={({ address }) => {
          onServiceAddressChange(address);
          setMapOpen(false);
        }}
      />
    </div>
  );
}
