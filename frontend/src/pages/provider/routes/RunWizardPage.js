import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProviderOrg } from '../../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../../utils/api';
import parseApiError from '../../../utils/parseApiError';
import { providerDispatchRunLive, providerDispatchRuns } from '../../../utils/providerPaths';

export default function RunWizardPage() {
  const { orgSlug } = useProviderOrg();
  const { runId: runIdParam } = useParams();
  const navigate = useNavigate();
  const isNew = runIdParam === 'new' || !runIdParam;
  const [runId, setRunId] = useState(isNew ? null : runIdParam);
  const [regions, setRegions] = useState([]);
  const [crewOptions, setCrewOptions] = useState([]);
  const [run, setRun] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [preview, setPreview] = useState(null);
  const [seasonalOn, setSeasonalOn] = useState(true);
  const [selectedOneTime, setSelectedOneTime] = useState({});
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    region: '',
    run_date: new Date().toISOString().slice(0, 10),
    scheduled_start: '',
    crew_membership_ids: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadMeta = useCallback(async () => {
    const [rRes, cRes] = await Promise.all([
      jobsAPI.listDispatchRegions(orgSlug),
      jobsAPI.getDispatchCrew(orgSlug).catch(() => ({ data: {} })),
    ]);
    setRegions(Array.isArray(rRes.data) ? rRes.data : rRes.data?.results || []);
    const crew = cRes.data?.members || cRes.data?.crew || [];
    setCrewOptions(crew);
  }, [orgSlug]);

  const loadRun = useCallback(
    async (id) => {
      const res = await jobsAPI.getDispatchRun(orgSlug, id);
      setRun(res.data);
      setForm((f) => ({
        ...f,
        region: res.data.region || '',
        run_date: res.data.run_date || f.run_date,
        scheduled_start: res.data.scheduled_start?.slice(0, 16) || '',
        crew_membership_ids: res.data.crew_membership_ids || res.data.crews || [],
      }));
      setSeasonalOn(res.data.include_seasonal !== false);
      const cand = await jobsAPI.getDispatchRunCandidates(orgSlug, id).catch(() => ({ data: {} }));
      setCandidates(cand.data?.candidates || cand.data?.one_time || []);
    },
    [orgSlug]
  );

  useEffect(() => {
    loadMeta();
    if (!isNew && runIdParam) loadRun(runIdParam);
  }, [loadMeta, loadRun, isNew, runIdParam]);

  const toggleOneTime = (id) => {
    setSelectedOneTime((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const selectedIds = useMemo(
    () => Object.keys(selectedOneTime).filter((k) => selectedOneTime[k]),
    [selectedOneTime]
  );

  const ensureDraft = async () => {
    if (runId) return runId;
    setBusy(true);
    try {
      const res = await jobsAPI.createDispatchRun(orgSlug, {
        region: form.region,
        run_date: form.run_date,
        scheduled_start: form.scheduled_start || null,
        crew_membership_ids: form.crew_membership_ids,
      });
      const id = res.data.id;
      setRunId(id);
      setRun(res.data);
      navigate(`/provider/${orgSlug}/runs/${id}`, { replace: true });
      return id;
    } finally {
      setBusy(false);
    }
  };

  const saveBasics = async () => {
    setError('');
    setBusy(true);
    try {
      const id = await ensureDraft();
      await jobsAPI.patchDispatchRun(orgSlug, id, {
        region: form.region,
        run_date: form.run_date,
        scheduled_start: form.scheduled_start || null,
        crew_membership_ids: form.crew_membership_ids,
        include_seasonal: seasonalOn,
        one_time_property_ids: selectedIds.map(Number),
        one_time_booking_ids: candidates
          .filter((c) => selectedIds.includes(String(c.id)))
          .map((c) => c.booking_id)
          .filter(Boolean),
      });
      setStep(3);
      const opt = await jobsAPI.optimizeDispatchRun(orgSlug, id, {
        include_seasonal: seasonalOn,
      });
      setPreview(opt.data);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!runId) return;
    setBusy(true);
    setError('');
    try {
      await jobsAPI.commitDispatchRun(orgSlug, runId);
      navigate(providerDispatchRunLive(orgSlug, runId));
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const seasonalSummary = run?.seasonal_summary || preview?.seasonal_summary;

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-4 pb-24">
      <div>
        <Link to={providerDispatchRuns(orgSlug)} className="text-sm text-luminexa-accent">
          ← Runs
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900">
          {isNew && !runId ? 'New run' : 'Plan run'}
        </h1>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {step === 1 && (
        <section className="lx-card space-y-4">
          <h2 className="font-semibold text-slate-900">1 · Region & crews</h2>
          <label className="block text-sm">
            Region
            <select
              className="lx-input mt-1 w-full"
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
            >
              <option value="">Select</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Run date
            <input
              type="date"
              className="lx-input mt-1 w-full"
              value={form.run_date}
              onChange={(e) => setForm((f) => ({ ...f, run_date: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            Scheduled start
            <input
              type="datetime-local"
              className="lx-input mt-1 w-full"
              value={form.scheduled_start}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_start: e.target.value }))}
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Crews on this run</legend>
            <div className="mt-2 space-y-2">
              {crewOptions.map((c) => {
                const id = c.id || c.membership_id;
                const checked = form.crew_membership_ids.includes(id);
                return (
                  <label key={id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setForm((f) => ({
                          ...f,
                          crew_membership_ids: checked
                            ? f.crew_membership_ids.filter((x) => x !== id)
                            : [...f.crew_membership_ids, id],
                        }));
                      }}
                    />
                    {c.display_name || c.email}
                  </label>
                );
              })}
              {!crewOptions.length && (
                <p className="text-sm text-slate-500">Add crew members first.</p>
              )}
            </div>
          </fieldset>
          <button
            type="button"
            disabled={busy || !form.region}
            className="lx-btn-primary w-full min-h-[48px]"
            onClick={async () => {
              try {
                setBusy(true);
                await ensureDraft();
                if (runId || !isNew) await loadRun(runId || runIdParam);
                setStep(2);
              } catch (e) {
                setError(parseApiError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Next: stops
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="lx-card space-y-4">
          <h2 className="font-semibold text-slate-900">2 · Stops</h2>
          <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={seasonalOn}
              onChange={(e) => setSeasonalOn(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="font-semibold text-slate-900">Seasonal group</span>
              <br />
              {seasonalSummary
                ? `${seasonalSummary.count} properties · ${seasonalSummary.total_minutes || seasonalSummary.duration_label || '—'}`
                : 'Include all live + expiring seasonal/monthly contracts in this region.'}
            </span>
          </label>
          <div>
            <p className="text-sm font-medium text-slate-700">One-time adds</p>
            <ul className="mt-2 space-y-2">
              {candidates.map((c) => (
                <li key={c.id}>
                  <label className="flex items-center justify-between gap-2 rounded-xl ring-1 ring-slate-100 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedOneTime[c.id])}
                        onChange={() => toggleOneTime(String(c.id))}
                      />
                      {c.label || c.address || c.customer_name || `Stop ${c.id}`}
                    </span>
                    {c.solo_detour_min != null && (
                      <span className="shrink-0 text-teal-700">+{c.solo_detour_min} min</span>
                    )}
                  </label>
                </li>
              ))}
              {!candidates.length && (
                <p className="text-sm text-slate-500">No one-time candidates right now.</p>
              )}
            </ul>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={saveBasics}
            className="lx-btn-primary w-full min-h-[48px]"
          >
            {busy ? 'Optimizing…' : 'Optimize preview'}
          </button>
        </section>
      )}

      {step === 3 && preview && (
        <section className="lx-card space-y-4">
          <h2 className="font-semibold text-slate-900">3 · Review & commit</h2>
          {(preview.routes || preview.per_crew || []).map((route, idx) => (
            <div key={idx} className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">
                Crew {idx + 1}
                {route.crew_name ? ` · ${route.crew_name}` : ''}
              </p>
              <ol className="mt-2 list-decimal pl-5 text-sm text-slate-700">
                {(route.stops || route.stop_ids || []).map((s, i) => (
                  <li key={i}>{typeof s === 'object' ? s.address || s.label : `Stop ${s}`}</li>
                ))}
              </ol>
            </div>
          ))}
          {preview.fix_addresses?.length > 0 && (
            <p className="text-sm text-amber-800">
              Fix addresses before commit: {preview.fix_addresses.join(', ')}
            </p>
          )}
          <button
            type="button"
            disabled={busy || preview.can_commit === false}
            onClick={commit}
            className="lx-btn-primary w-full min-h-[48px]"
          >
            {busy ? 'Committing…' : 'Commit run'}
          </button>
        </section>
      )}
    </div>
  );
}
