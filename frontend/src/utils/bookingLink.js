function isLoopbackHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function httpOrigin(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.origin;
  } catch {
    return '';
  }
}

/**
 * Public SPA origin for customer-facing links.
 * Prefer the current browser host so production never advertises a baked-in
 * localhost URL from REACT_APP_PUBLIC_URL / Docker build args.
 */
export function getPublicAppUrl() {
  const pageOrigin = httpOrigin(
    typeof window !== 'undefined' ? window.location?.origin : ''
  );
  const envOrigin = httpOrigin(process.env.REACT_APP_PUBLIC_URL);

  if (pageOrigin && !isLoopbackHost(new URL(pageOrigin).hostname)) {
    return pageOrigin;
  }
  if (envOrigin && !isLoopbackHost(new URL(envOrigin).hostname)) {
    return envOrigin;
  }
  return pageOrigin || envOrigin || 'http://localhost:3000';
}

export function getCustomerAppointmentUrl(token) {
  if (!token) return '';
  return `${getPublicAppUrl()}/b/${encodeURIComponent(token)}`;
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
