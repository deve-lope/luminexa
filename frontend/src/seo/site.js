export const SITE_URL = 'https://luminex-a.com';
export const APP_URL = 'https://app.luminex-a.com';
export const SITE_NAME = 'Luminexa';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.luminexa.app';
export const APP_STORE_URL = 'https://apps.apple.com/ca/app/luminexa/id6804875374';
export const OG_IMAGE_PATH = '/images/og-home.jpg';
export const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`;

export const HOME_TITLE = 'Luminexa | Book local services across Canada';
export const HOME_DESCRIPTION =
  'Book local services across Canada — snow removal, car detailing, gardening, cleaning, and more. Enter your address, see prices or request a quote, and pick an open time. Customers use Luminexa free. Launch cities include Ottawa and Toronto.';

export function absUrl(path = '/', host = SITE_URL) {
  if (!path) return `${host}/`;
  if (/^https?:\/\//i.test(path)) return path;
  const prefix = path.startsWith('/') ? path : `/${path}`;
  return `${host}${prefix}`;
}

export function absAppUrl(path = '/') {
  return absUrl(path, APP_URL);
}

export const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description: HOME_DESCRIPTION,
  areaServed: { '@type': 'Country', name: 'Canada' },
  sameAs: [PLAY_STORE_URL, APP_STORE_URL],
};

export const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description: HOME_DESCRIPTION,
  inLanguage: 'en-CA',
  publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
};
