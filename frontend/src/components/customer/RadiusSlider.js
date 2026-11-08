import React from 'react';
import {
  RADIUS_MILE_OPTIONS,
  formatRadiusMiles,
} from '../../constants/locationSearch';

/**
 * “Search within” control: slider for any distance, tick buttons for the common ones.
 * Shared by the Find list filters and the map view.
 */
export default function RadiusSlider({ value, onChange, disabled = false, className = '' }) {
  const min = RADIUS_MILE_OPTIONS[0].value;
  const max = RADIUS_MILE_OPTIONS[RADIUS_MILE_OPTIONS.length - 1].value;

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="search-radius" className="lx-eyebrow">
          Search within
        </label>
        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-teal-800 ring-1 ring-teal-100">
          {formatRadiusMiles(value)}
        </span>
      </div>
      <input
        id="search-radius"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-6 w-full cursor-pointer accent-luminexa-accent disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="mt-1 flex justify-between">
        {RADIUS_MILE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`min-h-[32px] rounded-full px-2.5 text-[11px] font-semibold tabular-nums transition disabled:opacity-50 ${
              Number(value) === o.value
                ? 'bg-luminexa-accent text-white'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {o.value} mi
          </button>
        ))}
      </div>
    </div>
  );
}
