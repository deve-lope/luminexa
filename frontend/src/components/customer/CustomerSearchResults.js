import React from 'react';
import { Link } from 'react-router-dom';
import BusinessTypeTileGrid from './BusinessTypeTileGrid';
import { bookService, businessPage } from '../../utils/customerPaths';
import { formatServiceMeta } from '../../utils/serviceDisplay';

export default function CustomerSearchResults({ results, query, loading }) {
  const searchTerm = query?.trim() || '';

  if (!searchTerm && !loading && !results) return null;

  if (loading) {
    return <p className="text-sm text-slate-500">Searching…</p>;
  }

  const types = results?.business_types || [];
  const providers = results?.providers || [];
  const services = results?.services || [];
  const empty = types.length === 0 && providers.length === 0 && services.length === 0;

  if (empty) {
    return (
      <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        {searchTerm
          ? `No results for "${searchTerm}". Try another keyword or browse categories below.`
          : 'No nearby services found. Try a different area or widen the radius.'}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {types.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Categories
          </h2>
          <BusinessTypeTileGrid types={types} />
        </section>
      )}
      {providers.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Providers
          </h2>
          <ul className="space-y-2">
            {providers.map((p) => (
              <li key={p.slug}>
                <Link
                  to={businessPage(p.slug)}
                  className="flex min-h-[56px] items-center gap-3 rounded-xl bg-white p-3 shadow-sm transition hover:shadow-md"
                >
                  {p.logo_url ? (
                    <img
                      src={p.logo_url}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-400">
                      {p.name?.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{p.name}</p>
                    {p.tagline && (
                      <p className="truncate text-sm text-slate-600">{p.tagline}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {services.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Services
          </h2>
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={`${s.organization_slug}-${s.id}`}>
                <Link
                  to={bookService(s.organization_slug, s.id)}
                  className="block rounded-xl bg-white p-3 shadow-sm transition hover:shadow-md"
                >
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-sm text-slate-600">{s.organization_name}</p>
                  {(s.location || s.location_short) && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      📍 {s.location || s.location_short}
                    </p>
                  )}
                  {formatServiceMeta(s) && (
                    <p className="mt-1 text-xs text-slate-500">{formatServiceMeta(s)}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
