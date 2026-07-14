import React from 'react';
import {
  formatServiceAddressDisplay,
  formatServiceAddressForMaps,
} from '../customer/ServiceLocationInput';

/** Query string safe for Google / Apple Maps destination. */
export function mapsQueryFromAddress(value) {
  return formatServiceAddressForMaps(value);
}

export function googleMapsDirectionsUrl(address) {
  const q = mapsQueryFromAddress(address);
  if (!q) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

export function appleMapsDirectionsUrl(address) {
  const q = mapsQueryFromAddress(address);
  if (!q) return null;
  return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}`;
}

/**
 * Job / service location with Get directions via Google Maps and Apple Maps.
 */
export default function ServiceAddressBlock({
  address,
  title = 'Job location',
  subtitle = '',
  emptyLabel = 'No address provided.',
  className = 'rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100',
}) {
  const raw = (address || '').trim();
  if (!raw) {
    return (
      <section className={className}>
        <h2 className="text-sm font-semibold uppercase text-slate-500">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        <p className="mt-3 text-sm text-slate-500">{emptyLabel}</p>
      </section>
    );
  }

  const display = formatServiceAddressDisplay(raw);
  const googleUrl = googleMapsDirectionsUrl(raw);
  const appleUrl = appleMapsDirectionsUrl(raw);

  return (
    <section className={className}>
      <h2 className="text-sm font-semibold uppercase text-slate-500">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      <p className="mt-3 whitespace-pre-wrap text-base font-medium leading-relaxed text-slate-900">
        {display}
      </p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Get directions
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {googleUrl && (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            <MapsPinIcon />
            Google Maps
          </a>
        )}
        {appleUrl && (
          <a
            href={appleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            <MapsPinIcon />
            Apple Maps
          </a>
        )}
      </div>
    </section>
  );
}

function MapsPinIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
