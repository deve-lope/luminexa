export const SITE_URL = 'https://app.luminex-a.com';
export const SITE_NAME = 'Luminexa';

export const HOME_TITLE = 'Luminexa | Book local services';
export const HOME_DESCRIPTION =
  'Book local services — snow removal, car detailing, gardening, cleaning, and more — with prices and real time slots.';

export function absUrl(path = '/') {
  if (!path) return `${SITE_URL}/`;
  if (/^https?:\/\//i.test(path)) return path;
  const prefix = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${prefix}`;
}

export const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description: HOME_DESCRIPTION,
  areaServed: [
    { '@type': 'City', name: 'Ottawa' },
    { '@type': 'City', name: 'Toronto' },
  ],
  sameAs: ['https://play.google.com/store/apps/details?id=com.luminexa.app'],
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
