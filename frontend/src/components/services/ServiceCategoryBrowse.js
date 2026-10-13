import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import BusinessTypeIcon from '../icons/BusinessTypeIcon';
import { IconChevronLeft } from '../icons/NavIcons';
import { ServiceRow } from './ServiceCatalogView';

/**
 * Category grid first; tap a category to see its services.
 * Selected category is kept in ?cat= so Back from service details restores the list.
 */
export default function ServiceCategoryBrowse({
  catalog,
  orgSlug,
  forceShowPrice = false,
  renderServiceActions,
  emptyMessage = 'No services listed yet.',
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  useCustomerProviderUrls = false,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('cat');

  const tiles = useMemo(() => {
    const categories = (catalog?.categories || []).filter((c) => (c.services || []).length > 0);
    const uncategorized = catalog?.uncategorized_services || [];
    const items = categories.map((c) => {
      const services = c.services || [];
      return {
        id: String(c.id),
        name: c.name,
        services,
        count: services.length,
      };
    });
    if (uncategorized.length > 0) {
      items.push({
        id: '__other__',
        name: categories.length > 0 ? 'Other services' : 'All services',
        services: uncategorized,
        count: uncategorized.length,
      });
    }
    return items;
  }, [catalog]);

  const setCategory = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id == null) {
      next.delete('cat');
    } else {
      next.set('cat', String(id));
    }
    setSearchParams(next, { replace: true });
  };

  if (!tiles.length) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  if (selectedId == null || !tiles.some((t) => t.id === selectedId)) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => setCategory(tile.id)}
            className="lx-card-interactive flex min-h-[112px] flex-col items-start justify-between text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-700 ring-1 ring-teal-100">
              <BusinessTypeIcon name={tile.name} className="h-5 w-5" />
            </span>
            <span className="mt-3 block">
              <span className="block font-semibold leading-snug tracking-tight text-slate-900">
                {tile.name}
              </span>
              <span className="mt-0.5 block text-sm text-slate-500">
                {tile.count} service{tile.count === 1 ? '' : 's'}
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  const selected = tiles.find((t) => t.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className="lx-btn-secondary min-h-[40px] gap-1 px-3.5"
        >
          <IconChevronLeft className="h-4 w-4" />
          All categories
        </button>
        <span className="text-sm font-medium text-slate-500">
          {selected.count} service{selected.count === 1 ? '' : 's'}
        </span>
      </div>
      <h2 className="text-xl font-bold tracking-tight text-slate-900">{selected.name}</h2>
      {selectable && (
        <p className="flex items-start gap-2 rounded-xl bg-teal-50/70 px-3 py-2.5 text-sm text-teal-900 ring-1 ring-teal-100">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-teal-700"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Tick several services of the same type (all mobile, or all in-shop) to book them in one
            visit.
          </span>
        </p>
      )}
      <ul className="grid gap-3 xl:grid-cols-2">
        {selected.services.map((svc) => (
          <ServiceRow
            key={svc.id}
            service={svc}
            orgSlug={orgSlug}
            forceShowPrice={forceShowPrice}
            actions={renderServiceActions?.(svc)}
            selectable={selectable}
            selected={selectedIds.includes(svc.id) || selectedIds.includes(String(svc.id))}
            onToggleSelect={onToggleSelect}
            useCustomerProviderUrls={useCustomerProviderUrls}
            categoryId={selectedId}
          />
        ))}
      </ul>
    </div>
  );
}
