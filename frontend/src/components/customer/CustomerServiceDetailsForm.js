import React from 'react';
import ServiceLocationInput from './ServiceLocationInput';

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
      <ServiceLocationInput
        value={serviceAddress}
        onChange={onServiceAddressChange}
        label="Service location"
      />
    </div>
  );
}
