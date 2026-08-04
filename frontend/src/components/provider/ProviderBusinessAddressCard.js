import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orgProfileAPI } from '../../utils/api';
import { formatRadiusMiles } from '../../constants/locationSearch';
import { providerSettings } from '../../utils/providerPaths';

function formatLocation(loc) {
  const street = (loc.address || '').trim();
  const place = [loc.city, loc.state].filter(Boolean).join(', ');
  const postal = (loc.postal_code || '').trim();
  const line = [street, place, postal].filter(Boolean).join(', ');
  if (line) return line;
  return loc.name || 'Location set on map';
}

/**
 * Read-only business service address(es) on provider My Account.
 * Editing stays in Settings → service area.
 */
export default function ProviderBusinessAddressCard({ orgSlug }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);
    orgProfileAPI
      .listLocations(orgSlug)
      .then((res) => {
        const list = (Array.isArray(res.data) ? res.data : []).filter(
          (l) => l.is_active !== false
        );
        setLocations(list);
      })
      .catch(() => setError('Could not load business address.'))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Business address</h2>
          <p className="mt-1 text-sm text-slate-600">
            Where customers find you and your service area is based.
          </p>
        </div>
        <Link
          to={providerSettings(orgSlug)}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit in Settings
        </Link>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading address…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : locations.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No service location set yet.{' '}
          <Link to={providerSettings(orgSlug)} className="font-medium text-luminexa-accent">
            Add one in Settings
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {locations.map((loc) => (
            <li
              key={loc.id}
              className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {loc.name || (loc.is_primary ? 'Primary' : 'Location')}
                </p>
                {loc.is_primary && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                    Primary
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-700">{formatLocation(loc)}</p>
              {loc.radius_miles != null && (
                <p className="mt-1 text-xs text-slate-500">
                  Serves within {formatRadiusMiles(Number(loc.radius_miles))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
