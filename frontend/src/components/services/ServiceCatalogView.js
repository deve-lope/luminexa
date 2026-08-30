import React from 'react';
import { Link } from 'react-router-dom';
import ServiceRatingSummary from './ServiceRatingSummary';
import ServiceThumb from './ServiceThumb';
import {
  customerProviderServiceDetail,
  serviceDetail,
} from '../../utils/customerPaths';
import {
  formatFulfillmentLabel,
  formatServicePrice,
  servicePriceIsForVisit,
} from '../../utils/serviceDisplay';

export function ServiceRow({
  service,
  orgSlug,
  forceShowPrice,
  actions,
  selectable = false,
  selected = false,
  onToggleSelect,
  useCustomerProviderUrls = false,
  categoryId = null,
}) {
  const price = formatServicePrice(service, undefined, { forceShowPrice });
  // “Quote on request” is redundant on list cards — the CTA is already Request quote.
  const showPriceBadge = Boolean(price) && price !== 'Quote on request';
  const priceForVisit = showPriceBadge && servicePriceIsForVisit(service);
  const fulfillment = formatFulfillmentLabel(service);
  let detailHref = null;
  if (orgSlug) {
    detailHref = useCustomerProviderUrls
      ? customerProviderServiceDetail(orgSlug, service.id)
      : serviceDetail(orgSlug, service.id);
    if (categoryId) {
      detailHref += `?cat=${encodeURIComponent(categoryId)}`;
    }
  }

  return (
    <li
      id={`service-${service.id}`}
      className={`overflow-hidden rounded-xl border shadow-sm ${
        selected
          ? 'border-luminexa-accent bg-white ring-1 ring-luminexa-accent/30'
          : 'border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-emerald-50/50 ring-1 ring-teal-100/70'
      }`}
    >
      <div className="h-1 bg-gradient-to-r from-teal-700 via-luminexa-accent to-cyan-400" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          {selectable && (
            <label className="mt-0.5 flex shrink-0 cursor-pointer items-start">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect?.(service.id)}
                className="mt-1 h-4 w-4 accent-luminexa-accent"
                aria-label={`Select ${service.name}`}
              />
            </label>
          )}
          <ServiceThumb service={service} className="h-14 w-14" iconClassName="h-7 w-7" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-snug text-teal-950">{service.name}</h3>
            {service.rating_summary?.count > 0 && (
              <div className="mt-1">
                <ServiceRatingSummary summary={service.rating_summary} compact />
              </div>
            )}
            {showPriceBadge && (
              <div className="mt-2">
                <p className="inline-block max-w-full rounded-lg bg-teal-700 px-2 py-1 text-xs font-semibold leading-snug text-white">
                  {price}
                </p>
                {priceForVisit && (
                  <p className="mt-1 text-[11px] font-medium text-teal-800">for this visit</p>
                )}
              </div>
            )}
            {fulfillment && (
              <div className="mt-2">
                <span className="rounded-lg bg-white/90 px-2 py-0.5 text-xs font-medium text-teal-900 ring-1 ring-teal-200/80">
                  {fulfillment}
                </span>
              </div>
            )}
            {detailHref && (
              <Link
                to={detailHref}
                className="mt-2 inline-flex min-h-[36px] items-center text-sm font-medium text-luminexa-accent"
              >
                Show full details →
              </Link>
            )}
          </div>
        </div>
        {actions && (
          <div className="mt-3 border-t border-teal-100/80 pt-3 [&>a]:flex [&>a]:min-h-[44px] [&>a]:w-full [&>a]:items-center [&>a]:justify-center [&>button]:flex [&>button]:min-h-[44px] [&>button]:w-full [&>button]:items-center [&>button]:justify-center">
            {actions}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Renders grouped service catalog (categories + uncategorized).
 * catalog: { categories: [{ id, name, services }], uncategorized_services: [] }
 */
export default function ServiceCatalogView({
  catalog,
  orgSlug,
  forceShowPrice = false,
  renderServiceActions,
  emptyMessage = 'No services listed yet.',
}) {
  const categories = catalog?.categories || [];
  const uncategorized = catalog?.uncategorized_services || [];
  const hasAny =
    categories.some((c) => (c.services || []).length > 0) || uncategorized.length > 0;

  if (!hasAny) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-8">
      {categories.map((cat) => {
        const services = cat.services || [];
        if (!services.length) return null;
        return (
          <section key={cat.id}>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{cat.name}</h2>
            <ul className="space-y-3">
              {services.map((svc) => (
                <ServiceRow
                  key={svc.id}
                  service={svc}
                  orgSlug={orgSlug}
                  forceShowPrice={forceShowPrice}
                  actions={renderServiceActions?.(svc)}
                />
              ))}
            </ul>
          </section>
        );
      })}
      {uncategorized.length > 0 && (
        <section>
          {categories.length > 0 && (
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Other services</h2>
          )}
          <ul className="space-y-3">
            {uncategorized.map((svc) => (
              <ServiceRow
                key={svc.id}
                service={svc}
                orgSlug={orgSlug}
                forceShowPrice={forceShowPrice}
                actions={renderServiceActions?.(svc)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function buildCatalogFromFlat(services) {
  const byCat = new Map();
  const uncategorized = [];
  for (const svc of services || []) {
    if (svc.category_id && svc.category_name) {
      if (!byCat.has(svc.category_id)) {
        byCat.set(svc.category_id, { id: svc.category_id, name: svc.category_name, services: [] });
      }
      byCat.get(svc.category_id).services.push(svc);
    } else {
      uncategorized.push(svc);
    }
  }
  return {
    categories: Array.from(byCat.values()),
    uncategorized_services: uncategorized,
  };
}
