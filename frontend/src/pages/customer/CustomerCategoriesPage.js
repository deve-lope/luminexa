import React, { useEffect, useMemo, useState } from 'react';
import BusinessTypeTileGrid from '../../components/customer/BusinessTypeTileGrid';
import ServiceSearchBar from '../../components/customer/ServiceSearchBar';
import Skeleton from '../../components/Skeleton';
import { businessesAPI } from '../../utils/api';

export default function CustomerCategoriesPage() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    businessesAPI
      .listBusinessTypes()
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setTypes(list);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load categories.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withProviders = types.filter((t) => (t.provider_count ?? 0) > 0);
    if (!q) return withProviders;
    return withProviders.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.slug?.toLowerCase().includes(q)
    );
  }, [types, query]);

  if (loading) {
    return (
      <div className="space-y-4 pb-4" aria-busy="true" aria-label="Loading categories">
        <Skeleton className="h-11 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-36 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lx-empty">
        <p className="text-sm font-medium text-slate-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <p className="lx-eyebrow">Browse</p>
        <h1 className="lx-section-title mt-1">All categories</h1>
        <p className="lx-muted mt-1.5">
          Categories with services available, most booked first.
        </p>
      </div>

      <ServiceSearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search categories…"
        sticky={false}
      />

      {filtered.length === 0 ? (
        <div className="lx-empty">
          <p className="text-sm font-medium text-slate-800">
            {query.trim() ? 'No categories match your search.' : 'No categories with services yet.'}
          </p>
        </div>
      ) : (
        <BusinessTypeTileGrid types={filtered} />
      )}
    </div>
  );
}
