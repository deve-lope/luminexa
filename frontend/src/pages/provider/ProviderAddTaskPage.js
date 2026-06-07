import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { providerHome } from '../../utils/providerPaths';
import { jobsAPI } from '../../utils/api';
import { formatTime, formatWhen, toDatetimeLocalValue } from '../../utils/datetime';
import { RECURRENCE_OPTIONS, parseApiError } from '../../utils/taskDisplay';

function defaultDueLocal() {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return toDatetimeLocalValue(d.toISOString());
}

export default function ProviderAddTaskPage() {
  const { orgSlug, activeOrg } = useProviderOrg();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedJobId = searchParams.get('job');

  const [jobs, setJobs] = useState([]);
  const [title, setTitle] = useState('');
  const [taskDue, setTaskDue] = useState(defaultDueLocal);
  const [recurrence, setRecurrence] = useState('none');
  const [jobId, setJobId] = useState(preselectedJobId || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const orgId = activeOrg?.organization;

  const loadJobs = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    try {
      const res = await jobsAPI.getProviderDashboard(orgSlug);
      setJobs(res.data?.upcoming_jobs || []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!preselectedJobId || !jobs.length) return;
    const job = jobs.find((j) => String(j.id) === preselectedJobId);
    if (job) {
      setJobId(preselectedJobId);
      setTaskDue(toDatetimeLocalValue(job.start_at));
      setRecurrence('none');
    }
  }, [preselectedJobId, jobs]);

  const selectedJob = useMemo(
    () => (jobId ? jobs.find((j) => String(j.id) === jobId) : null),
    [jobId, jobs]
  );

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Enter what you need to do.');
      return;
    }
    if (!orgId) {
      setError('Business not loaded — go back and try again.');
      return;
    }
    if (recurrence !== 'none' && !taskDue) {
      setError('Set a deadline for repeating tasks.');
      return;
    }

    setSaving(true);
    try {
      await jobsAPI.createTask({
        organization: orgId,
        title: trimmed,
        priority: selectedJob ? 3 : 2,
        job: selectedJob ? selectedJob.id : null,
        recurrence: selectedJob ? 'none' : recurrence,
        due_at: taskDue
          ? new Date(taskDue).toISOString()
          : selectedJob
            ? selectedJob.start_at
            : null,
      });
      navigate(providerHome(orgSlug));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">New task</h2>
        <p className="mt-1 text-sm text-slate-500">
          Optional: link to a job so you remember to finish before you leave.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-4 ring-1 ring-slate-100">
          <label className="block text-sm font-medium text-slate-700">
            Task
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Restock supplies"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm"
              autoFocus
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Link to job (optional)
            <select
              value={jobId}
              onChange={(e) => {
                const id = e.target.value;
                setJobId(id);
                if (id) {
                  const j = jobs.find((job) => String(job.id) === id);
                  if (j) {
                    setTaskDue(toDatetimeLocalValue(j.start_at));
                    setRecurrence('none');
                  }
                }
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm"
            >
              <option value="">None — general task</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.service_name} · {job.customer_name} ({formatTime(job.start_at)})
                </option>
              ))}
            </select>
          </label>

          {selectedJob && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
              Finish before <strong>{formatWhen(selectedJob.start_at)}</strong>
            </p>
          )}

          <label className="block text-sm font-medium text-slate-700">
            {selectedJob ? 'Complete by' : 'Deadline (optional)'}
            <input
              type="datetime-local"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm"
            />
          </label>

          {!selectedJob && (
            <label className="block text-sm font-medium text-slate-700">
              Repeats
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm"
              >
                {RECURRENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="w-full min-h-[48px] rounded-xl bg-luminexa-accent font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save task'}
          </button>
        </form>
      )}
    </div>
  );
}
