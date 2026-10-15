import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsAPI } from '../../../utils/api';
import { useProviderOrg } from '../../../contexts/ProviderOrgContext';
import parseApiError from '../../../utils/parseApiError';
import {
  providerDispatchRunLive,
  providerDispatchRunNew,
  providerDispatchRunWizard,
  providerDispatchRuns,
} from '../../../utils/providerPaths';
import { RUN_STATUS_LABEL } from '../../../utils/snowDispatch';

function SnowWeekStrip({ days, thresholdCm }) {
  if (!days?.length) {
    return (
      <p className="text-sm text-slate-500">Weather forecast will appear here when available.</p>
    );
  }
  const th = Number(thresholdCm) || 2;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {days.map((d) => {
        const cm = Number(d.snowfall_cm) || 0;
        const hot = d.over_threshold || cm >= th;
        return (
          <div
            key={d.date}
            className={`min-w-[4.5rem] shrink-0 rounded-xl px-2 py-3 text-center ring-1 ${
              hot ? 'bg-teal-50 ring-teal-300' : 'bg-white ring-slate-200'
            }`}
          >
            <p className="text-[10px] font-semibold uppercase text-slate-500">
              {new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">{cm.toFixed(1)}</p>
            <p className="text-[10px] text-slate-500">cm</p>
          </div>
        );
      })}
    </div>
  );
}

export default function DispatchHomePage() {
  const { orgSlug, activeOrg } = useProviderOrg();
  const [weather, setWeather] = useState(null);
  const [settings, setSettings] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError('');
    try {
      const [wRes, sRes, rRes] = await Promise.all([
        jobsAPI.getDispatchWeatherWeek(orgSlug).catch(() => ({ data: null })),
        jobsAPI.getDispatchSettings(orgSlug).catch(() => ({ data: null })),
        jobsAPI.listDispatchRuns(orgSlug, { limit: 8 }).catch(() => ({ data: [] })),
      ]);
      setWeather(wRes.data);
      setSettings(sRes.data);
      const list = Array.isArray(rRes.data) ? rRes.data : rRes.data?.results || [];
      setRuns(list);
    } catch (e) {
      setError(parseApiError(e) || 'Could not load dispatch home.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const threshold = settings?.snow_threshold_cm ?? weather?.threshold_cm ?? 2;
  const days = weather?.days || weather?.forecast || [];

  const upcomingRuns = runs.filter((r) =>
    ['draft', 'scheduled', 'in_progress'].includes(r.status)
  );

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Today</h1>
        <p className="mt-1 text-sm text-slate-600">
          {activeOrg?.organization_name || 'Snow dispatch'} · threshold {threshold} cm
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
      )}

      <section className="lx-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">7-day snow</h2>
          <Link to={providerDispatchRuns(orgSlug)} className="text-sm font-medium text-luminexa-accent">
            All runs
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading forecast…</p>
        ) : (
          <SnowWeekStrip days={days} thresholdCm={threshold} />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming runs</h2>
          <Link to={providerDispatchRunNew(orgSlug)} className="lx-btn-primary px-3 py-1.5 text-sm">
            Create run
          </Link>
        </div>
        {!loading && !upcomingRuns.length && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No active runs. Start one when snow is on the way.
          </p>
        )}
        <ul className="space-y-2">
          {upcomingRuns.map((run) => {
            const to =
              run.status === 'draft'
                ? providerDispatchRunWizard(orgSlug, run.id)
                : providerDispatchRunLive(orgSlug, run.id);
            return (
              <li key={run.id}>
                <Link
                  to={to}
                  className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 text-white shadow-md"
                >
                  <div>
                    <p className="font-semibold">{run.region_name || 'Run'}</p>
                    <p className="text-sm text-slate-300">
                      {run.run_date} · {RUN_STATUS_LABEL[run.status] || run.status}
                    </p>
                  </div>
                  <span className="text-teal-300">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
