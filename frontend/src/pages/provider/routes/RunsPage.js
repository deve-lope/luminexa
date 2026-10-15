import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProviderOrg } from '../../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../../utils/api';
import parseApiError from '../../../utils/parseApiError';
import {
  providerDispatchRunLive,
  providerDispatchRunNew,
  providerDispatchRunWizard,
} from '../../../utils/providerPaths';
import { RUN_STATUS_LABEL } from '../../../utils/snowDispatch';

function statusTone(status) {
  if (status === 'in_progress') return 'bg-teal-50 text-teal-800 ring-teal-200';
  if (status === 'scheduled') return 'bg-violet-50 text-violet-800 ring-violet-200';
  if (status === 'draft') return 'bg-slate-100 text-slate-700 ring-slate-200';
  if (status === 'completed') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

export default function RunsPage() {
  const { orgSlug } = useProviderOrg();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    setError('');
    jobsAPI
      .listDispatchRuns(orgSlug)
      .then((res) => setRuns(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch((e) => setError(parseApiError(e) || 'Could not load runs.'))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Runs</h1>
          <p className="mt-1 text-sm text-slate-600">Plan, optimize, and track snow routes.</p>
        </div>
        <Link to={providerDispatchRunNew(orgSlug)} className="lx-btn-primary shrink-0 px-4 py-2 text-sm">
          New run
        </Link>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
      )}

      {loading && <p className="text-sm text-slate-500">Loading runs…</p>}

      {!loading && !runs.length && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No runs yet. Create one when snow is forecast.
        </p>
      )}

      <ul className="space-y-3">
        {runs.map((run) => {
          const href =
            run.status === 'draft'
              ? providerDispatchRunWizard(orgSlug, run.id)
              : run.status === 'in_progress' || run.status === 'scheduled'
                ? providerDispatchRunLive(orgSlug, run.id)
                : providerDispatchRunWizard(orgSlug, run.id);
          return (
            <li key={run.id}>
              <Link
                to={href}
                className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:ring-teal-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {run.region_name || 'Region'} · {run.run_date || 'Date TBD'}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusTone(run.status)}`}
                  >
                    {RUN_STATUS_LABEL[run.status] || run.status}
                  </span>
                </div>
                {run.scheduled_start && (
                  <p className="mt-1 text-sm text-slate-600">
                    Start {new Date(run.scheduled_start).toLocaleString()}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
