import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => setCategory(tile.id)}
            className="flex min-h-[88px] flex-col items-start justify-center rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-luminexa-accent/40 hover:shadow-md"
          >
            <span className="font-semibold text-slate-900">{tile.name}</span>
            <span className="mt-1 text-sm text-slate-500">
              {tile.count} service{tile.count === 1 ? '' : 's'}
            </span>
          </button>
        ))}
      </div>
    );
  }

  const selected = tiles.find((t) => t.id === selectedId);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setCategory(null)}
        className="inline-flex min-h-[40px] items-center text-sm font-medium text-luminexa-accent"
      >
        ← All categories
      </button>
      <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
      {selectable && (
        <p className="text-sm text-slate-500">
          Select one or more services of the same type (all mobile, or all in-shop), then book them
          together.
        </p>
      )}
      <ul className="space-y-3">
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
