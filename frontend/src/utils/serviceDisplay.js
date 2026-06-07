const defaultCurrency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
});

function formatAmount(value, currency = defaultCurrency) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return currency.format(n);
}

/** Human-readable price for catalog cards (fixed, range, or quote). */
export function formatServicePrice(service, currency = defaultCurrency, options = {}) {
  const { forceShowPrice = false } = options;
  if (!forceShowPrice && service?.show_price === false) return null;

  const type = service?.pricing_type || 'fixed';
  if (type === 'quote') return 'Quote on request';

  const min = formatAmount(service?.base_price, currency);
  const max = formatAmount(service?.price_max, currency);

  if (type === 'range' && min && max) return `${min} – ${max}`;
  if (min) return min;
  if (type === 'range' && max) return `Up to ${max}`;
  return null;
}

/** Duration + optional price for public service cards. */
export function formatServiceMeta(service, currency = defaultCurrency, options = {}) {
  const { forceShowPrice = false } = options;
  const mins = service?.duration_minutes;
  const parts = [];
  if (mins != null) parts.push(`${mins} min`);
  const price = formatServicePrice(service, currency, { forceShowPrice });
  if (price) parts.push(price);
  return parts.join(' · ');
}
