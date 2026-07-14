export function getPublicAppUrl() {
  const fromEnv = process.env.REACT_APP_PUBLIC_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export function getCustomerBookingUrl(slug) {
  if (!slug) return '';
  return `${getPublicAppUrl()}/book/${encodeURIComponent(slug)}`;
}

export function getProviderBookingUrl(slug) {
  if (!slug) return '';
  return `${getPublicAppUrl()}/provider/${encodeURIComponent(slug)}/schedule`;
}

export function getProviderBookingDetailUrl(orgSlug, bookingId) {
  if (!orgSlug || !bookingId) return '';
  return `${getPublicAppUrl()}/provider/${encodeURIComponent(orgSlug)}/schedule/booking/${bookingId}`;
}
