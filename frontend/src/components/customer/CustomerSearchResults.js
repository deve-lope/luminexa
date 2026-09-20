import React from 'react';
import { Link } from 'react-router-dom';
import BookableServiceCard from './BookableServiceCard';
import BusinessTypeTileGrid from './BusinessTypeTileGrid';
import ServiceRatingSummary from '../services/ServiceRatingSummary';
import { businessPage } from '../../utils/customerPaths';

export default function CustomerSearchResults({ results, query, areaLabel, loading }) {
  const searchTerm = query?.trim() || '';
  const hasArea = Boolean(areaLabel?.trim());

  if (!searchTerm && !hasArea && !loading && !results) return null;

  if (loading) {
    return (
      <div className="lx-card flex items-center gap-3 py-6 text-sm text-slate-500">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600"
          aria-hidden
        />
        Searching…
      </div>
    );
  }

  const types = results?.business_types || [];
  const providers = results?.providers || [];
  const services = results?.services || [];
  const empty = types.length === 0 && providers.length === 0 && services.length === 0;

  if (empty) {
    return (
      <p className="lx-card text-sm text-slate-600">
        {searchTerm
          ? `No results for “${searchTerm}”${hasArea ? ` near ${areaLabel}` : ''}. Try another keyword or ZIP code.`
          : hasArea
            ? `No services found near ${areaLabel}. Try a wider radius or another ZIP / postal code.`
            : 'No nearby services found. Try a different area or widen the radius.'}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 lg:text-xl">
            {searchTerm ? `Results for “${searchTerm}”` : 'Nearby services'}
          </h2>
          {hasArea && (
            <p className="mt-1 text-sm text-slate-600">
              Near <span className="font-medium text-slate-800">{areaLabel}</span>
            </p>
          )}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {[
            services.length ? `${services.length} service${services.length === 1 ? '' : 's'}` : null,
            providers.length ? `${providers.length} provider${providers.length === 1 ? '' : 's'}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {types.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Categories
          </h3>
          <BusinessTypeTileGrid types={types} />
        </section>
      )}

      {providers.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Providers
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {providers.map((p) => (
              <li key={p.slug || p.organization_slug}>
                <Link
                  to={businessPage(p.public_ref || p.slug || p.organization_slug)}
                  className="lx-card-interactive flex h-full items-center gap-3 !p-3"
                >
                  {p.logo_url ? (
                    <img
                      src={p.logo_url}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-slate-200/80"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-slate-100 text-lg font-semibold text-teal-800 ring-1 ring-slate-200/80">
                      {(p.name || p.organization_name || '?').charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold tracking-tight text-slate-900">
                      {p.name || p.organization_name}
                    </p>
                    {(p.tagline || p.location_short) && (
                      <p className="mt-0.5 truncate text-sm text-slate-600">
                        {p.tagline || p.location_short}
                      </p>
                    )}
                    {p.rating_summary?.count > 0 && (
                      <div className="mt-1">
                        <ServiceRatingSummary summary={p.rating_summary} compact />
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {services.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Services
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((s) => (
              <li key={`${s.organization_slug}-${s.id}`}>
                <BookableServiceCard service={s} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
