import React, { useMemo } from 'react';
import {
  countryHasRegionList,
  normalizeRegionSelection,
  regionsForCountry,
} from '../../constants/regions';

const defaultSelectClass =
  'w-full min-h-[48px] rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent';

const defaultInputClass =
  'w-full min-h-[48px] rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent';

/**
 * Province / state field: dropdown when the country has a known list, otherwise free text.
 */
export default function RegionSelect({
  id,
  value = '',
  onChange,
  country,
  label = 'Province / state',
  placeholder,
  disabled = false,
  invalid = false,
  selectClassName,
  inputClassName,
  onBlur,
}) {
  const regions = useMemo(() => regionsForCountry(country), [country]);
  const hasList = countryHasRegionList(country);
  const selectCls = selectClassName || defaultSelectClass;
  const inputCls = inputClassName || defaultInputClass;
  const invalidSelectCls = `${selectCls} border-red-300 focus:border-red-500 focus:ring-red-200`;
  const invalidInputCls = `${inputCls} border-red-300 focus:border-red-500 focus:ring-red-200`;

  const selectedValue = useMemo(() => {
    if (!hasList) return value;
    return normalizeRegionSelection(value, country) || '';
  }, [value, country, hasList]);

  if (!hasList) {
    return (
      <input
        id={id}
        type="text"
        autoComplete="address-level1"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder || label}
        aria-invalid={invalid}
        className={invalid ? invalidInputCls : inputCls}
      />
    );
  }

  return (
    <select
      id={id}
      value={selectedValue}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      aria-invalid={invalid}
      className={invalid ? invalidSelectCls : selectCls}
    >
      <option value="">{`Select ${label.toLowerCase()}`}</option>
      {regions.map((region) => (
        <option key={region.code || region.label} value={region.label}>
          {region.label}
        </option>
      ))}
    </select>
  );
}
