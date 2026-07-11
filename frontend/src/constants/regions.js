import { normalizeAddressCountry, stateLabelForCountry } from './addressCountries';

/** Canadian provinces and territories (full names). */
export const CANADIAN_PROVINCES = [
  { label: 'Alberta', code: 'AB' },
  { label: 'British Columbia', code: 'BC' },
  { label: 'Manitoba', code: 'MB' },
  { label: 'New Brunswick', code: 'NB' },
  { label: 'Newfoundland and Labrador', code: 'NL' },
  { label: 'Northwest Territories', code: 'NT' },
  { label: 'Nova Scotia', code: 'NS' },
  { label: 'Nunavut', code: 'NU' },
  { label: 'Ontario', code: 'ON' },
  { label: 'Prince Edward Island', code: 'PE' },
  { label: 'Quebec', code: 'QC' },
  { label: 'Saskatchewan', code: 'SK' },
  { label: 'Yukon', code: 'YT' },
];

/** US states and DC (full names). */
export const US_STATES = [
  { label: 'Alabama', code: 'AL' },
  { label: 'Alaska', code: 'AK' },
  { label: 'Arizona', code: 'AZ' },
  { label: 'Arkansas', code: 'AR' },
  { label: 'California', code: 'CA' },
  { label: 'Colorado', code: 'CO' },
  { label: 'Connecticut', code: 'CT' },
  { label: 'Delaware', code: 'DE' },
  { label: 'District of Columbia', code: 'DC' },
  { label: 'Florida', code: 'FL' },
  { label: 'Georgia', code: 'GA' },
  { label: 'Hawaii', code: 'HI' },
  { label: 'Idaho', code: 'ID' },
  { label: 'Illinois', code: 'IL' },
  { label: 'Indiana', code: 'IN' },
  { label: 'Iowa', code: 'IA' },
  { label: 'Kansas', code: 'KS' },
  { label: 'Kentucky', code: 'KY' },
  { label: 'Louisiana', code: 'LA' },
  { label: 'Maine', code: 'ME' },
  { label: 'Maryland', code: 'MD' },
  { label: 'Massachusetts', code: 'MA' },
  { label: 'Michigan', code: 'MI' },
  { label: 'Minnesota', code: 'MN' },
  { label: 'Mississippi', code: 'MS' },
  { label: 'Missouri', code: 'MO' },
  { label: 'Montana', code: 'MT' },
  { label: 'Nebraska', code: 'NE' },
  { label: 'Nevada', code: 'NV' },
  { label: 'New Hampshire', code: 'NH' },
  { label: 'New Jersey', code: 'NJ' },
  { label: 'New Mexico', code: 'NM' },
  { label: 'New York', code: 'NY' },
  { label: 'North Carolina', code: 'NC' },
  { label: 'North Dakota', code: 'ND' },
  { label: 'Ohio', code: 'OH' },
  { label: 'Oklahoma', code: 'OK' },
  { label: 'Oregon', code: 'OR' },
  { label: 'Pennsylvania', code: 'PA' },
  { label: 'Rhode Island', code: 'RI' },
  { label: 'South Carolina', code: 'SC' },
  { label: 'South Dakota', code: 'SD' },
  { label: 'Tennessee', code: 'TN' },
  { label: 'Texas', code: 'TX' },
  { label: 'Utah', code: 'UT' },
  { label: 'Vermont', code: 'VT' },
  { label: 'Virginia', code: 'VA' },
  { label: 'Washington', code: 'WA' },
  { label: 'West Virginia', code: 'WV' },
  { label: 'Wisconsin', code: 'WI' },
  { label: 'Wyoming', code: 'WY' },
];

/** Mexican states (full names). */
export const MEXICAN_STATES = [
  { label: 'Aguascalientes', code: 'AG' },
  { label: 'Baja California', code: 'BC' },
  { label: 'Baja California Sur', code: 'BS' },
  { label: 'Campeche', code: 'CM' },
  { label: 'Chiapas', code: 'CS' },
  { label: 'Chihuahua', code: 'CH' },
  { label: 'Ciudad de México', code: 'CX' },
  { label: 'Coahuila', code: 'CO' },
  { label: 'Colima', code: 'CL' },
  { label: 'Durango', code: 'DG' },
  { label: 'Guanajuato', code: 'GT' },
  { label: 'Guerrero', code: 'GR' },
  { label: 'Hidalgo', code: 'HG' },
  { label: 'Jalisco', code: 'JA' },
  { label: 'México', code: 'EM' },
  { label: 'Michoacán', code: 'MI' },
  { label: 'Morelos', code: 'MO' },
  { label: 'Nayarit', code: 'NA' },
  { label: 'Nuevo León', code: 'NL' },
  { label: 'Oaxaca', code: 'OA' },
  { label: 'Puebla', code: 'PU' },
  { label: 'Querétaro', code: 'QT' },
  { label: 'Quintana Roo', code: 'QR' },
  { label: 'San Luis Potosí', code: 'SL' },
  { label: 'Sinaloa', code: 'SI' },
  { label: 'Sonora', code: 'SO' },
  { label: 'Tabasco', code: 'TB' },
  { label: 'Tamaulipas', code: 'TM' },
  { label: 'Tlaxcala', code: 'TL' },
  { label: 'Veracruz', code: 'VE' },
  { label: 'Yucatán', code: 'YU' },
  { label: 'Zacatecas', code: 'ZA' },
];

/** Brazilian states and federal district (full names). */
export const BRAZILIAN_STATES = [
  { label: 'Acre', code: 'AC' },
  { label: 'Alagoas', code: 'AL' },
  { label: 'Amapá', code: 'AP' },
  { label: 'Amazonas', code: 'AM' },
  { label: 'Bahia', code: 'BA' },
  { label: 'Ceará', code: 'CE' },
  { label: 'Distrito Federal', code: 'DF' },
  { label: 'Espírito Santo', code: 'ES' },
  { label: 'Goiás', code: 'GO' },
  { label: 'Maranhão', code: 'MA' },
  { label: 'Mato Grosso', code: 'MT' },
  { label: 'Mato Grosso do Sul', code: 'MS' },
  { label: 'Minas Gerais', code: 'MG' },
  { label: 'Pará', code: 'PA' },
  { label: 'Paraíba', code: 'PB' },
  { label: 'Paraná', code: 'PR' },
  { label: 'Pernambuco', code: 'PE' },
  { label: 'Piauí', code: 'PI' },
  { label: 'Rio de Janeiro', code: 'RJ' },
  { label: 'Rio Grande do Norte', code: 'RN' },
  { label: 'Rio Grande do Sul', code: 'RS' },
  { label: 'Rondônia', code: 'RO' },
  { label: 'Roraima', code: 'RR' },
  { label: 'Santa Catarina', code: 'SC' },
  { label: 'São Paulo', code: 'SP' },
  { label: 'Sergipe', code: 'SE' },
  { label: 'Tocantins', code: 'TO' },
];

const REGIONS_BY_COUNTRY = {
  Canada: CANADIAN_PROVINCES,
  'United States': US_STATES,
  Mexico: MEXICAN_STATES,
  Brazil: BRAZILIAN_STATES,
};

/** Regions for a country, or empty when free-text entry is used. */
export function regionsForCountry(country) {
  const name = normalizeAddressCountry(country);
  return REGIONS_BY_COUNTRY[name] || [];
}

export function countryHasRegionList(country) {
  return regionsForCountry(country).length > 0;
}

/** Match a stored value to the canonical region label (by name or code). */
export function normalizeRegionSelection(value, country) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const regions = regionsForCountry(country);
  if (!regions.length) return trimmed;

  const lower = trimmed.toLowerCase();
  for (const region of regions) {
    if (region.label.toLowerCase() === lower) return region.label;
    if (region.code && region.code.toLowerCase() === lower) return region.label;
  }
  return '';
}

/** Validate province / state based on the selected country. */
export function validateProvince(value, { country } = {}) {
  const label = stateLabelForCountry(country);
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    return { valid: false, error: `${label} is required.`, normalized: '' };
  }

  const regions = regionsForCountry(country);
  if (!regions.length) {
    return { valid: true, error: null, normalized: trimmed };
  }

  const normalized = normalizeRegionSelection(trimmed, country);
  if (!normalized) {
    return {
      valid: false,
      error: `Select a valid ${label.toLowerCase()} from the list.`,
      normalized: '',
    };
  }
  return { valid: true, error: null, normalized };
}

function optionSearchText(label, code, country) {
  return `${label} ${code || ''} ${country}`.toLowerCase();
}

function normalizeExtra(label) {
  const trimmed = String(label || '').trim();
  if (!trimmed) return null;
  return {
    label: trimmed,
    code: '',
    country: '',
    searchText: trimmed.toLowerCase(),
  };
}

/** Flat list of all regions plus any API extras (e.g. from existing providers). */
export function buildAllRegionOptions(extraLabels = []) {
  const seen = new Set();
  const out = [];

  const add = (label, code, country) => {
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      label,
      code,
      country,
      searchText: optionSearchText(label, code, country),
    });
  };

  for (const p of CANADIAN_PROVINCES) add(p.label, p.code, 'Canada');
  for (const s of US_STATES) add(s.label, s.code, 'United States');
  for (const s of MEXICAN_STATES) add(s.label, s.code, 'Mexico');
  for (const s of BRAZILIAN_STATES) add(s.label, s.code, 'Brazil');
  for (const raw of extraLabels) {
    const extra = normalizeExtra(raw);
    if (extra) add(extra.label, extra.code, extra.country);
  }

  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Grouped for dropdown display. */
export function filterRegionGroups(query, extraLabels = [], { country } = {}) {
  const q = query.trim().toLowerCase();
  const countryFilter = (country || '').trim();
  const matchesCountry = (optCountry) =>
    !countryFilter || !optCountry || optCountry === countryFilter;

  const matches = (opt) =>
    (!q ||
      opt.searchText.includes(q) ||
      opt.label.toLowerCase().startsWith(q) ||
      (opt.code && opt.code.toLowerCase() === q)) &&
    matchesCountry(opt.country);

  const canada = CANADIAN_PROVINCES.map((p) => ({
    label: p.label,
    code: p.code,
    country: 'Canada',
    searchText: optionSearchText(p.label, p.code, 'Canada'),
  })).filter(matches);

  const us = US_STATES.map((s) => ({
    label: s.label,
    code: s.code,
    country: 'United States',
    searchText: optionSearchText(s.label, s.code, 'United States'),
  })).filter(matches);

  const mexico = MEXICAN_STATES.map((s) => ({
    label: s.label,
    code: s.code,
    country: 'Mexico',
    searchText: optionSearchText(s.label, s.code, 'Mexico'),
  })).filter(matches);

  const brazil = BRAZILIAN_STATES.map((s) => ({
    label: s.label,
    code: s.code,
    country: 'Brazil',
    searchText: optionSearchText(s.label, s.code, 'Brazil'),
  })).filter(matches);

  const extras = [];
  const seen = new Set(
    [...canada, ...us, ...mexico, ...brazil].map((o) => o.label.toLowerCase())
  );
  for (const raw of extraLabels) {
    const extra = normalizeExtra(raw);
    if (!extra || seen.has(extra.label.toLowerCase())) continue;
    if (!matches(extra)) continue;
    seen.add(extra.label.toLowerCase());
    extras.push(extra);
  }

  const groups = [];
  if (canada.length) groups.push({ title: 'Canada — provinces & territories', options: canada });
  if (us.length) groups.push({ title: 'United States — states', options: us });
  if (mexico.length) groups.push({ title: 'Mexico — states', options: mexico });
  if (brazil.length) groups.push({ title: 'Brazil — states', options: brazil });
  if (extras.length) groups.push({ title: 'From providers in app', options: extras });
  return groups;
}
