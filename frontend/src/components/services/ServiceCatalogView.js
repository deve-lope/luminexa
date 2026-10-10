import React from 'react';
import { Link } from 'react-router-dom';
import ServiceRatingSummary from './ServiceRatingSummary';
import ServiceThumb from './ServiceThumb';
import { IconShop, IconTruck } from '../icons/NavIcons';
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

  const hasFooter = showPriceBadge || detailHref || actions;
  const isShop = fulfillment === 'In-shop';

  return (
    <li
      id={`service-${service.id}`}
      className={`lx-card flex h-full flex-col transition duration-200 ${
        selected
          ? 'border-luminexa-accent bg-teal-50/40 ring-2 ring-luminexa-accent/30'
          : 'hover:border-teal-200'
      }`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <ServiceThumb
          service={service}
          className="h-16 w-16 sm:h-20 sm:w-20"
          iconClassName="h-8 w-8 sm:h-9 sm:w-9"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug tracking-tight text-slate-900">
            {service.name}
          </h3>
          {service.rating_summary?.count > 0 && (
            <div className="mt-1">
              <ServiceRatingSummary summary={service.rating_summary} compact />
            </div>
          )}
          {fulfillment && (
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                isShop
                  ? 'bg-violet-50 text-violet-800 ring-violet-200/80'
                  : 'bg-teal-50 text-teal-800 ring-teal-200/80'
              }`}
            >
              {isShop ? (
                <IconShop className="h-3.5 w-3.5" />
              ) : (
                <IconTruck className="h-3.5 w-3.5" />
              )}
              {fulfillment}
            </span>
          )}
        </div>
        {selectable && (
          <label
            className="-m-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"
            title={selected ? 'Remove from selection' : 'Select to book together'}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.(service.id)}
              className="peer sr-only"
              aria-label={`Select ${service.name}`}
            />
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border-2 border-slate-300 bg-white text-transparent shadow-sm transition peer-checked:border-luminexa-accent peer-checked:bg-luminexa-accent peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-luminexa-accent/40">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </label>
        )}
      </div>

      {hasFooter && (
        <div className="mt-auto flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {showPriceBadge ? (
            <div className="min-w-0 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
              <p className="text-lg font-bold leading-tight tracking-tight tabular-nums text-slate-900">
                {price}
              </p>
              {priceForVisit && (
                <p className="text-xs font-medium text-slate-500">for this visit</p>
              )}
            </div>
          ) : (
            <span className="hidden sm:block" />
          )}
          {(detailHref || actions) && (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
              {detailHref && (
                <Link
                  to={detailHref}
                  className={`lx-btn-ghost min-h-[44px] px-4 ${actions ? '' : 'col-span-2'}`}
                >
                  Full details
                </Link>
              )}
              {actions && (
                <div
                  className={`contents [&>a]:w-full [&>button]:w-full sm:[&>a]:w-auto sm:[&>button]:w-auto ${
                    detailHref ? '' : '[&>a]:col-span-2 [&>button]:col-span-2'
                  }`}
                >
                  {actions}
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
