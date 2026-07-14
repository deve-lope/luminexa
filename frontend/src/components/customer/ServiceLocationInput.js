import React, { useEffect, useRef, useState } from 'react';
import AddressCountrySelect from '../location/AddressCountrySelect';
import RegionSelect from '../location/RegionSelect';
import useAddressCountry from '../../hooks/useAddressCountry';
import { useAuth } from '../../contexts/AuthContext';
import {
  normalizeAddressCountry,
  postalLabelForCountry,
  stateLabelForCountry,
} from '../../constants/addressCountries';
import { validateProvince } from '../../constants/regions';
import {
  formatPostalLabel,
  normalizePostalInput,
  validatePostalCode,
} from '../../utils/postalInput';

const FIELD_ORDER = ['country', 'province', 'city', 'address1', 'address2', 'postalCode'];

const FIELD_LABELS = {
  country: 'Country',
  province: 'Province',
  city: 'City',
  address1: 'Address 1',
  address2: 'Address 2',
  postalCode: 'Postal code',
};

const LABEL_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_LABELS).map(([key, label]) => [label.toLowerCase(), key])
);

const EMPTY_FIELDS = {
  country: '',
  province: '',
  city: '',
  address1: '',
  address2: '',
  postalCode: '',
};

function isCountryToken(part) {
  return Boolean(normalizeAddressCountry(part));
}

function parseLegacyCommaAddress(value) {
  const parts = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const result = { ...EMPTY_FIELDS };
  if (!parts.length) return result;

  let index = 0;
  if (isCountryToken(parts[0])) {
    result.country = normalizeAddressCountry(parts[0]);
    index = 1;
  }

  const tailKeys = FIELD_ORDER.slice(1);
  for (let i = 0; i < tailKeys.length && index + i < parts.length; i += 1) {
    result[tailKeys[i]] = parts[index + i];
  }
  return result;
}

export function parseServiceAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return { ...EMPTY_FIELDS };

  // Labeled storage: "Country: …\nProvince: …" (also tolerate missing newlines).
  if (/country\s*:/i.test(raw) && /(?:address\s*1|city)\s*:/i.test(raw)) {
    return parseLabeledAddress(raw);
  }

  return parseLegacyCommaAddress(raw);
}

function parseLabeledAddress(raw) {
  const result = { ...EMPTY_FIELDS };
  const labelAlts = Object.values(FIELD_LABELS)
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const re = new RegExp(`(${labelAlts})\\s*:\\s*`, 'gi');
  const hits = [];
  let match;
  while ((match = re.exec(raw)) !== null) {
    hits.push({
      label: match[1],
      valueStart: match.index + match[0].length,
      nextAt: match.index,
    });
  }
  for (let i = 0; i < hits.length; i += 1) {
    const end = i + 1 < hits.length ? hits[i + 1].nextAt : raw.length;
    const field = LABEL_TO_FIELD[hits[i].label.toLowerCase()];
    if (!field) continue;
    result[field] = raw.slice(hits[i].valueStart, end).trim();
  }
  if (result.country) {
    result.country = normalizeAddressCountry(result.country) || result.country;
  }
  return result;
}

export function formatServiceAddress(fields) {
  return FIELD_ORDER.filter((key) => String(fields[key] || '').trim())
    .map((key) => `${FIELD_LABELS[key]}: ${String(fields[key]).trim()}`)
    .join('\n');
}

function usefulAddress2(address1, address2) {
  const a1 = String(address1 || '').trim();
  const a2 = String(address2 || '').trim();
  if (!a2) return '';
  if (!a1) return a2;
  // Skip unit/line2 when it's only the street number already in address1.
  const streetNum = a1.match(/^\d+[A-Za-z]?/)?.[0];
  if (streetNum && a2 === streetNum) return '';
  if (a1.toLowerCase().includes(a2.toLowerCase())) return '';
  return a2;
}

/** Human-readable lines for profile / booking summaries. */
export function formatServiceAddressDisplay(value) {
  const fields = parseServiceAddress(value);
  const lines = [];
  if (fields.address1) lines.push(fields.address1);
  const line2 = usefulAddress2(fields.address1, fields.address2);
  if (line2) lines.push(line2);
  const cityLine = [fields.city, fields.province, fields.postalCode].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  if (fields.country) lines.push(fields.country);
  const formatted = lines.join('\n');
  return formatted || String(value || '').trim();
}

/**
 * Single-line destination for Google / Apple Maps (never send labeled storage format).
 */
export function formatServiceAddressForMaps(value) {
  const fields = parseServiceAddress(value);
  const parts = [];
  if (fields.address1) parts.push(fields.address1);
  const line2 = usefulAddress2(fields.address1, fields.address2);
  if (line2) parts.push(line2);
  if (fields.city) parts.push(fields.city);
  if (fields.province) parts.push(fields.province);
  if (fields.postalCode) {
    parts.push(formatPostalLabel(fields.postalCode) || fields.postalCode);
  }
  if (fields.country) parts.push(fields.country);
  if (parts.length) return parts.join(', ');

  // Last resort: strip "Label: " prefixes if present.
  const stripped = String(value || '')
    .replace(/(?:^|\n)\s*(?:Country|Province|City|Address 1|Address 2|Postal code)\s*:\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped;
}

export function hasValidSavedServiceAddress(user) {
  const raw = (user?.default_service_address || '').trim();
  if (!raw) return false;
  return validateServiceLocationValue(raw).valid;
}

export function validateServiceLocationValue(value) {
  const fields = parseServiceAddress(value);
  const hasLocation =
    fields.address1.trim() ||
    fields.city.trim() ||
    fields.province.trim() ||
    fields.postalCode.trim();

  if (!hasLocation) {
    return { valid: false, error: 'Please enter the service location.' };
  }

  if (!fields.address1.trim()) {
    return { valid: false, error: 'Please enter address line 1.' };
  }

  if (!fields.city.trim()) {
    return { valid: false, error: 'Please enter the city.' };
  }

  const provinceCheck = validateProvince(fields.province, { country: fields.country });
  if (!provinceCheck.valid) {
    return provinceCheck;
  }

  const postalCheck = validatePostalCode(fields.postalCode, {
    country: fields.country,
    mode: 'complete',
  });
  if (!postalCheck.valid) {
    return postalCheck;
  }

  return {
    valid: true,
    error: null,
    fields: {
      ...fields,
      province: provinceCheck.normalized,
      postalCode: postalCheck.normalized,
    },
    normalizedPostal: postalCheck.normalized,
    normalizedProvince: provinceCheck.normalized,
  };
}

/**
 * Service location: manual address fields only.
 */
export default function ServiceLocationInput({
  value,
  onChange,
  label = 'Service location',
  required = false,
  hint = 'Enter the service address below.',
  id = 'service-address',
  country: countryProp,
  onCountryChange,
  onValidityChange,
}) {
  const { user } = useAuth();
  const { country: profileCountry, setCountry, loading: countryLoading } = useAddressCountry({
    initialCountry: countryProp || user?.address_country,
  });
  const lastEmittedRef = useRef(value || '');
  const [postalTouched, setPostalTouched] = useState(false);
  const [fields, setFields] = useState(() => {
    const parsed = parseServiceAddress(value);
    if (!parsed.country && profileCountry) {
      parsed.country = profileCountry;
    }
    return parsed;
  });

  useEffect(() => {
    const nextValue = value || '';
    if (nextValue === lastEmittedRef.current) return;

    const parsed = parseServiceAddress(nextValue);
    if (!parsed.country && profileCountry) {
      parsed.country = profileCountry;
    }
    lastEmittedRef.current = nextValue;
    setFields(parsed);
  }, [value, profileCountry]);

  const updateFields = (patch) => {
    setFields((prev) => {
      const next = { ...prev, ...patch };
      const formatted = formatServiceAddress(next);
      lastEmittedRef.current = formatted;
      onChange(formatted);
      return next;
    });
  };

  const handleCountryChange = (nextCountry) => {
    const normalized = normalizeAddressCountry(nextCountry) || nextCountry;
    setCountry(normalized);
    onCountryChange?.(normalized);
    const provinceStillValid = validateProvince(fields.province, { country: normalized }).valid;
    updateFields({
      country: normalized,
      province: provinceStillValid ? fields.province : '',
    });
  };

  const activeCountry = fields.country || profileCountry;
  const provinceLabel = stateLabelForCountry(activeCountry);
  const postalLabel = postalLabelForCountry(activeCountry);
  const postalCheck = validatePostalCode(fields.postalCode, {
    country: activeCountry,
    mode: 'complete',
  });
  const showPostalError = postalTouched && !postalCheck.valid;

  useEffect(() => {
    onValidityChange?.(postalCheck.valid);
  }, [postalCheck.valid, onValidityChange]);

  const inputClassName =
    'w-full min-h-[48px] rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent';
  const invalidInputClassName =
    'w-full min-h-[48px] rounded-xl border border-red-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-200';

  return (
    <div className="space-y-3">
      <p className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </p>

      <AddressCountrySelect
        id={`${id}-country`}
        value={fields.country || profileCountry}
        disabled={countryLoading && !fields.country && !profileCountry}
        onChange={handleCountryChange}
        hint=""
      />

      <div>
        <label htmlFor={`${id}-province`} className="mb-1 block text-sm font-medium text-slate-700">
          {provinceLabel}
        </label>
        <RegionSelect
          id={`${id}-province`}
          value={fields.province}
          onChange={(nextProvince) => updateFields({ province: nextProvince })}
          country={activeCountry}
          label={provinceLabel}
          selectClassName={inputClassName}
          inputClassName={inputClassName}
        />
      </div>

      <div>
        <label htmlFor={`${id}-city`} className="mb-1 block text-sm font-medium text-slate-700">
          City
        </label>
        <input
          id={`${id}-city`}
          type="text"
          autoComplete="address-level2"
          value={fields.city}
          onChange={(e) => updateFields({ city: e.target.value })}
          placeholder="City"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor={`${id}-address1`} className="mb-1 block text-sm font-medium text-slate-700">
          Address 1
        </label>
        <input
          id={`${id}-address1`}
          type="text"
          autoComplete="address-line1"
          value={fields.address1}
          onChange={(e) => updateFields({ address1: e.target.value })}
          placeholder="Street address"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor={`${id}-address2`} className="mb-1 block text-sm font-medium text-slate-700">
          Address 2 <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id={`${id}-address2`}
          type="text"
          autoComplete="address-line2"
          value={fields.address2}
          onChange={(e) => updateFields({ address2: e.target.value })}
          placeholder="Apartment, suite, unit"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor={`${id}-postal`} className="mb-1 block text-sm font-medium text-slate-700">
          {postalLabel}
        </label>
        <input
          id={`${id}-postal`}
          type="text"
          autoComplete="postal-code"
          value={formatPostalLabel(fields.postalCode)}
          onChange={(e) =>
            updateFields({ postalCode: normalizePostalInput(e.target.value) })
          }
          onBlur={() => setPostalTouched(true)}
          placeholder={postalLabel}
          aria-invalid={showPostalError}
          className={showPostalError ? invalidInputClassName : inputClassName}
        />
        {showPostalError && (
          <p className="mt-1 text-xs text-red-600">{postalCheck.error}</p>
        )}
      </div>

      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}
