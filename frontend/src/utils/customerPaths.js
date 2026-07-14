/** Customer-facing URLs — public provider pages use /customer/provider/pro12 */

export function customerProviderPage(providerKey) {
  return `/customer/provider/${providerKey}`;
}

export function customerProviderService(providerKey, serviceId) {
  return `/customer/provider/${providerKey}/${serviceId}`;
}

export function customerProviderServiceDetail(providerKey, serviceId) {
  return `/customer/provider/${providerKey}/services/${serviceId}`;
}

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

/** Guest/public book URL (also accepts pro12 or slug). */
export function businessPage(providerKey) {
  return `/book/${providerKey}`;
}

export function bookService(providerKey, serviceId) {
  return `/book/${providerKey}/${serviceId}`;
}

/** Multi-service checkout for one provider. serviceIds: number[] */
export function bookMultipleServices(providerKey, serviceIds) {
  const ids = (serviceIds || []).map(String).filter(Boolean).join(',');
  const q = ids ? `?services=${encodeURIComponent(ids)}` : '';
  return `/book/${providerKey}/checkout${q}`;
}

export function customerProviderCheckout(providerKey, serviceIds) {
  const ids = (serviceIds || []).map(String).filter(Boolean).join(',');
  const q = ids ? `?services=${encodeURIComponent(ids)}` : '';
  return `/customer/provider/${providerKey}/checkout${q}`;
}

export function serviceDetail(providerKey, serviceId) {
  return `/book/${providerKey}/services/${serviceId}`;
}

export function servicesBrowse() {
  return '/services';
}
