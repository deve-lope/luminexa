const CURRENCY_CODES = new Set(['CAD', 'USD']);

/** Resolve ISO currency from a service/org/booking payload (defaults CAD). */
export function currencyCodeFor(source) {
  if (!source) return 'CAD';
  if (typeof source === 'string') {
    const code = source.trim().toUpperCase();
    return CURRENCY_CODES.has(code) ? code : 'CAD';
  }
  const direct = String(source.currency || '').trim().toUpperCase();
  if (CURRENCY_CODES.has(direct)) return direct;
  return 'CAD';
}

export function moneyFormatter(currencyOrSource = 'CAD') {
  const code = currencyCodeFor(currencyOrSource);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
    });
  } catch {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'CAD',
    });
  }
}

function formatterFor(serviceOrCurrency) {
  if (serviceOrCurrency && typeof serviceOrCurrency.format === 'function') {
    return serviceOrCurrency;
  }
  return moneyFormatter(serviceOrCurrency);
}

function formatAmount(value, currency = moneyFormatter('CAD')) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return currency.format(n);
}

/** Convert stored minutes → hours string for form inputs. */
export function hoursFromMinutes(mins) {
  const n = Number(mins);
  if (!Number.isFinite(n) || n <= 0) return '1';
  const h = n / 60;
  return Number.isInteger(h) ? String(h) : String(Math.round(h * 100) / 100);
}

/** Convert hours input → minutes for the API (min 15). */
export function minutesFromHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return 60;
  return Math.max(15, Math.round(n * 60));
}

/** Human-readable duration from minutes (shown as hours). */
export function formatDurationLabel(mins) {
  const n = Number(mins);
  if (!Number.isFinite(n) || n <= 0) return null;
  const h = Math.round((n / 60) * 100) / 100;
  if (h === 1) return '1 hour';
  return `${h} hours`;
}

/** Job length — not an hourly rate. */
export function formatDurationTakesLabel(mins) {
  const duration = formatDurationLabel(mins);
  return duration ? `Takes ${duration}` : null;
}

/** True when the listed price is for the whole visit, not per hour. */
export function servicePriceIsForVisit(service) {
  if (!service) return false;
  const type = service.pricing_type || 'fixed';
  if (type === 'quote' && !(Number(service.base_price) > 0)) return false;
  return true;
}

/** Human-readable price for catalog cards (fixed, range, average, or legacy quote). */
export function formatServicePrice(service, currency, options = {}) {
  const { forceShowPrice = false } = options;
  if (!forceShowPrice && service?.show_price === false) return null;

  const type = service?.pricing_type || 'fixed';
  const fmt = formatterFor(currency ?? service);
  const min = formatAmount(service?.base_price, fmt);
  const max = formatAmount(service?.price_max, fmt);

  if (type === 'range' && min && max) return `${min} – ${max}`;
  if (type === 'range' && min) return `From ${min}`;
  if (type === 'average' && min) return `About ${min}`;
  if (type === 'quote') {
    if (min && Number(service?.base_price) > 0) return `About ${min}`;
    return 'Quote on request';
  }
  if (min) return min;
  if (type === 'range' && max) return `Up to ${max}`;
  return null;
}

/** Non-fixed catalog prices always use quote-before-confirm. */
export function serviceRequiresQuote(serviceOrType) {
  const type =
    typeof serviceOrType === 'string'
      ? serviceOrType
      : serviceOrType?.pricing_type;
  return type === 'range' || type === 'average' || type === 'quote';
}

/** Duration + optional price for public service cards. */
export function formatServiceMeta(service, currency, options = {}) {
  const { forceShowPrice = false } = options;
  const parts = [];
  const duration = formatDurationLabel(service?.duration_minutes);
  if (duration) parts.push(duration);
  const price = formatServicePrice(service, currency, { forceShowPrice });
  if (price) parts.push(price);
  const fulfillment = formatFulfillmentLabel(service);
  if (fulfillment) parts.push(fulfillment);
  return parts.join(' · ');
}

export function isShopService(service) {
  return (service?.fulfillment_kind || 'mobile') === 'shop';
}

export function isMobileService(service) {
  return !isShopService(service);
}

/** Short label for catalogs and badges. */
export function formatFulfillmentLabel(service) {
  if (!service) return null;
  return isShopService(service) ? 'In-shop' : 'Mobile';
}

/** Clear customer-facing explanation of where the job happens. */
export function formatFulfillmentDescription(service) {
  if (isShopService(service)) {
    return 'In-shop — you come to the business';
  }
  return 'Mobile — we come to you';
}

export function formatJobLocationLabel(bookingOrService) {
  if (bookingOrService?.job_location_label) return bookingOrService.job_location_label;
  if (isShopService(bookingOrService)) return 'Job location — come to the shop';
  return 'Job location — we come to you';
}

/** Cover photo, else first gallery photo. Empty string when none. */
export function serviceThumbnailUrl(service) {
  if (!service) return '';
  const cover = service.image_url || (typeof service.image === 'string' ? service.image : '');
  if (cover) return cover;
  const first = (service.gallery || [])[0];
  return first?.image_url || '';
}
