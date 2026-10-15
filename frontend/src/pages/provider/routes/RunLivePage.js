import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProviderOrg } from '../../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../../utils/api';
import parseApiError from '../../../utils/parseApiError';
import { providerDispatchRuns } from '../../../utils/providerPaths';

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
      <div className="h-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function RunLivePage() {
  const { orgSlug } = useProviderOrg();
  const { runId } = useParams();
  const [live, setLive] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!orgSlug || !runId) return;
    jobsAPI
      .getDispatchRunLive(orgSlug, runId)
      .then((res) => setLive(res.data))
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug, runId]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const overall = live?.overall_percent ?? live?.progress_percent ?? 0;
  const routes = live?.routes || [];

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <Link to={providerDispatchRuns(orgSlug)} className="text-sm text-luminexa-accent">
        ← Runs
      </Link>
      <div>
        <h1 className="text-xl font-bold text-slate-900">Live run</h1>
        <p className="mt-1 text-sm text-slate-600">
          {live?.region_name || 'Region'} · {live?.run_date || ''}
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && live && (
        <>
          <section className="lx-card space-y-2">
            <div className="flex justify-between text-sm font-medium text-slate-700">
              <span>Overall</span>
              <span>{Math.round(overall)}%</span>
            </div>
            <ProgressBar value={overall} />
          </section>

          {routes.map((route) => (
            <section key={route.id || route.vehicle_index} className="lx-card space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">
                  {route.crew_name || `Crew ${route.vehicle_index ?? ''}`}
                </p>
                <span className="text-sm text-slate-600">
                  {Math.round(route.progress_percent ?? route.percent ?? 0)}%
                </span>
              </div>
              <ProgressBar value={route.progress_percent ?? route.percent} />
              {route.last_latitude != null && (
                <p className="text-xs text-slate-500">
                  Last GPS {new Date(route.last_ping_at || Date.now()).toLocaleTimeString()} ·{' '}
                  {Number(route.last_latitude).toFixed(4)}, {Number(route.last_longitude).toFixed(4)}
                </p>
              )}
              <ul className="space-y-2">
                {(route.stops || []).map((stop) => (
                  <li
                    key={stop.id}
                    className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        #{stop.sequence} {stop.address_line || stop.service_line1 || 'Stop'}
                      </p>
                      <p className="text-xs capitalize text-slate-500">{stop.status}</p>
                    </div>
                    {stop.photo_count > 0 && (
                      <span className="text-xs text-teal-700">{stop.photo_count} photo(s)</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
