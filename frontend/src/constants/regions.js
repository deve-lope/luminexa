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
  for (const raw of extraLabels) {
    const extra = normalizeExtra(raw);
    if (extra) add(extra.label, extra.code, extra.country);
  }

  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Grouped for dropdown display. */
export function filterRegionGroups(query, extraLabels = []) {
  const q = query.trim().toLowerCase();
  const matches = (opt) =>
    !q ||
    opt.searchText.includes(q) ||
    opt.label.toLowerCase().startsWith(q) ||
    (opt.code && opt.code.toLowerCase() === q);

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

  const extras = [];
  const seen = new Set([...canada, ...us].map((o) => o.label.toLowerCase()));
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
  if (extras.length) groups.push({ title: 'From providers in app', options: extras });
  return groups;
}
