/** Customer-facing URLs (no /customer/provider/... paths). */

export function customerHome() {
  return '/customer';
}

export function customerBookings() {
  return '/customer/bookings';
}

export function customerHistory() {
  return '/customer/history';
}

export function customerFind() {
  return '/customer/find';
}

export function customerFindType(typeSlug) {
  return `/customer/find/${typeSlug}`;
}

export function publicServicesCatalog(slug) {
  return `/book/${slug}/services`;
}

export function businessPage(slug) {
  return `/book/${slug}`;
}

export function bookService(slug, serviceId) {
  return `/book/${slug}/${serviceId}`;
}

export function serviceDetail(slug, serviceId) {
  return `/book/${slug}/services/${serviceId}`;
}

export function servicesBrowse() {
  return '/services';
}
