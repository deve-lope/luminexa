/** Americas-only countries for address entry and geocoding filters. */

export const AMERICAS_COUNTRY_GROUPS = [
  {
    title: 'North America',
    countries: [
      { code: 'CA', name: 'Canada' },
      { code: 'US', name: 'United States' },
      { code: 'MX', name: 'Mexico' },
    ],
  },
  {
    title: 'Central America',
    countries: [
      { code: 'BZ', name: 'Belize' },
      { code: 'CR', name: 'Costa Rica' },
      { code: 'SV', name: 'El Salvador' },
      { code: 'GT', name: 'Guatemala' },
      { code: 'HN', name: 'Honduras' },
      { code: 'NI', name: 'Nicaragua' },
      { code: 'PA', name: 'Panama' },
    ],
  },
  {
    title: 'Caribbean',
    countries: [
      { code: 'AG', name: 'Antigua and Barbuda' },
      { code: 'BS', name: 'Bahamas' },
      { code: 'BB', name: 'Barbados' },
      { code: 'CU', name: 'Cuba' },
      { code: 'DM', name: 'Dominica' },
      { code: 'DO', name: 'Dominican Republic' },
      { code: 'GD', name: 'Grenada' },
      { code: 'HT', name: 'Haiti' },
      { code: 'JM', name: 'Jamaica' },
      { code: 'KN', name: 'Saint Kitts and Nevis' },
      { code: 'LC', name: 'Saint Lucia' },
      { code: 'VC', name: 'Saint Vincent and the Grenadines' },
      { code: 'TT', name: 'Trinidad and Tobago' },
    ],
  },
  {
    title: 'South America',
    countries: [
      { code: 'AR', name: 'Argentina' },
      { code: 'BO', name: 'Bolivia' },
      { code: 'BR', name: 'Brazil' },
      { code: 'CL', name: 'Chile' },
      { code: 'CO', name: 'Colombia' },
      { code: 'EC', name: 'Ecuador' },
      { code: 'GY', name: 'Guyana' },
      { code: 'PY', name: 'Paraguay' },
      { code: 'PE', name: 'Peru' },
      { code: 'SR', name: 'Suriname' },
      { code: 'UY', name: 'Uruguay' },
      { code: 'VE', name: 'Venezuela' },
    ],
  },
];

export const SUPPORTED_ADDRESS_COUNTRIES = AMERICAS_COUNTRY_GROUPS.flatMap((g) => g.countries);

const ISO_TO_COUNTRY = Object.fromEntries(
  SUPPORTED_ADDRESS_COUNTRIES.map(({ code, name }) => [code, name])
);

const NAME_TO_COUNTRY = Object.fromEntries(
  SUPPORTED_ADDRESS_COUNTRIES.flatMap(({ name }) => {
    const entries = [[name.toLowerCase(), name]];
    if (name === 'United States') {
      entries.push(['usa', name], ['us', name], ['united states of america', name]);
    }
    if (name === 'Brazil') entries.push(['brasil', name]);
    if (name === 'Mexico') entries.push(['méxico', name], ['mexico', name]);
    return entries;
  })
);

export const ADDRESS_COUNTRY_STORAGE_KEY = 'luminexa_address_country';

export function countryFromNavigator() {
  if (typeof navigator === 'undefined') return '';
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const match = /[-_]([A-Za-z]{2})\s*$/i.exec(lang || '');
    if (match) {
      const name = ISO_TO_COUNTRY[match[1].toUpperCase()];
      if (name) return name;
    }
  }
  return '';
}

export function normalizeAddressCountry(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  if (NAME_TO_COUNTRY[key]) return NAME_TO_COUNTRY[key];
  if (key.length === 2) {
    const fromIso = ISO_TO_COUNTRY[key.toUpperCase()];
    if (fromIso) return fromIso;
  }
  for (const { name } of SUPPORTED_ADDRESS_COUNTRIES) {
    if (name.toLowerCase() === key) return name;
  }
  return '';
}

export function isSupportedAddressCountry(value) {
  const normalized = normalizeAddressCountry(value);
  return Boolean(normalized);
}

export function defaultAddressCountry() {
  return 'Canada';
}

const POSTAL_PLACEHOLDERS = {
  Canada: 'e.g. K1A0B1',
  'United States': 'e.g. 90210',
  Mexico: 'e.g. 06600',
  Brazil: 'e.g. 01310100',
  Argentina: 'e.g. C1425',
  Colombia: 'e.g. 110111',
};

export function postalPlaceholderForCountry(country) {
  const name = normalizeAddressCountry(country);
  return POSTAL_PLACEHOLDERS[name] || 'Postal / ZIP code';
}

export function stateLabelForCountry(country) {
  const name = normalizeAddressCountry(country);
  if (name === 'Canada') return 'Province / territory';
  if (name === 'United States' || name === 'Mexico' || name === 'Brazil') return 'State';
  return 'Province / state / region';
}

export function postalLabelForCountry(country) {
  const name = normalizeAddressCountry(country);
  if (name === 'United States') return 'ZIP code';
  if (name === 'Brazil') return 'CEP';
  if (name === 'Mexico') return 'Postal code';
  return 'PIN / postal code';
}
