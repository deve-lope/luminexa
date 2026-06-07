import React from 'react';
import { Link } from 'react-router-dom';
import ServiceRatingSummary from './ServiceRatingSummary';
import { serviceDetail } from '../../utils/customerPaths';
import { formatServiceMeta } from '../../utils/serviceDisplay';

export function ServiceRow({ service, orgSlug, forceShowPrice, actions }) {
  const meta = formatServiceMeta(service, undefined, { forceShowPrice });
  const detailHref = orgSlug ? serviceDetail(orgSlug, service.id) : null;

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">{service.name}</h3>
          {service.rating_summary?.count > 0 && (
            <div className="mt-1">
              <ServiceRatingSummary summary={service.rating_summary} compact />
            </div>
          )}
          {meta && <p className="mt-2 text-sm font-medium text-slate-700">{meta}</p>}
          {detailHref && (
            <Link
              to={detailHref}
              className="mt-2 inline-flex min-h-[36px] items-center text-sm font-medium text-luminexa-accent"
            >
              Show full details →
            </Link>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
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
