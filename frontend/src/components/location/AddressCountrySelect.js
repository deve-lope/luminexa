import React from 'react';
import { AMERICAS_COUNTRY_GROUPS, SUPPORTED_ADDRESS_COUNTRIES } from '../../constants/addressCountries';

const defaultSelectClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent';

/**
 * Country picker for address search / geocoding filters (Americas only).
 */
export default function AddressCountrySelect({
  id = 'address-country',
  value,
  onChange,
  disabled = false,
  className = '',
  selectClassName,
  dark = false,
  hint = 'Auto-detected from your network when possible. Change if it looks wrong.',
  grouped = true,
}) {
  const selectCls =
    selectClassName ||
    (dark
      ? 'w-full rounded-lg border border-white/10 bg-luminexa-navy/80 px-3 py-2.5 text-sm text-luminexa-mist outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent'
      : defaultSelectClass);
  const labelClass = dark
    ? 'mb-1 block text-sm font-medium text-luminexa-mist'
    : 'mb-1 block text-sm font-medium text-slate-700';
  const hintClass = dark ? 'mt-1 text-xs text-luminexa-mist/60' : 'mt-1 text-xs text-slate-500';

  const safeValue = SUPPORTED_ADDRESS_COUNTRIES.some((c) => c.name === value)
    ? value
    : SUPPORTED_ADDRESS_COUNTRIES[0].name;

  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        Country
      </label>
      <select
        id={id}
        value={safeValue}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={selectCls}
      >
        {grouped
          ? AMERICAS_COUNTRY_GROUPS.map((group) => (
              <optgroup key={group.title} label={group.title}>
                {group.countries.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))
          : SUPPORTED_ADDRESS_COUNTRIES.map((c) => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
      </select>
      {hint ? <p className={hintClass}>{hint}</p> : null}
    </div>
  );
}
