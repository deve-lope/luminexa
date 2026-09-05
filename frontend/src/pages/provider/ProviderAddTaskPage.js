import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { providerHome, providerScheduleDetail } from '../../utils/providerPaths';
import { parseReturnTo } from '../../utils/navigationBack';
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const preselectedJobId = searchParams.get('job');
  const jobLocked = Boolean(preselectedJobId);

  const [jobs, setJobs] = useState([]);
  const [linkedBooking, setLinkedBooking] = useState(null);
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
      const upcoming = res.data?.upcoming_jobs || [];
      setJobs(upcoming);

      if (preselectedJobId) {
        const fromDash = upcoming.find((j) => String(j.id) === preselectedJobId);
        if (fromDash) {
          setLinkedBooking(fromDash);
          setJobId(preselectedJobId);
          setTaskDue(toDatetimeLocalValue(fromDash.start_at));
          setRecurrence('none');
        } else {
          try {
            const bookingRes = await jobsAPI.getBooking(preselectedJobId);
            const b = bookingRes.data;
            const asJob = {
              id: b.id,
              service_name: b.service_name,
              customer_name: b.customer_name,
              start_at: b.start_at,
            };
            setLinkedBooking(asJob);
            setJobs((prev) => (prev.some((j) => String(j.id) === String(b.id)) ? prev : [asJob, ...prev]));
            setJobId(String(b.id));
            setTaskDue(toDatetimeLocalValue(b.start_at));
            setRecurrence('none');
          } catch {
            setLinkedBooking(null);
          }
        }
      }
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [orgSlug, preselectedJobId]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const selectedJob = useMemo(() => {
    if (jobLocked && linkedBooking) return linkedBooking;
    return jobId ? jobs.find((j) => String(j.id) === jobId) : null;
  }, [jobId, jobs, jobLocked, linkedBooking]);

  const afterSavePath = () => {
    const returnTo = parseReturnTo(location.search);
    if (returnTo) return returnTo;
    if (preselectedJobId) {
      return providerScheduleDetail(orgSlug, 'booking', preselectedJobId);
    }
    return providerHome(orgSlug);
  };

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

    const linkedJobId = jobLocked
      ? Number(preselectedJobId) || preselectedJobId
      : selectedJob?.id ?? null;

    setSaving(true);
    try {
      await jobsAPI.createTask({
        organization: orgId,
        title: trimmed,
        priority: linkedJobId ? 3 : 2,
        job: linkedJobId,
        recurrence: linkedJobId ? 'none' : recurrence,
        due_at: taskDue
          ? new Date(taskDue).toISOString()
          : selectedJob?.start_at || linkedBooking?.start_at || null,
      });
      navigate(afterSavePath());
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
          {jobLocked
            ? 'This task will be linked to the current job.'
            : 'Optional: link to a job so you remember to finish before you leave.'}
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

          {jobLocked ? (
            <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
              <p className="font-medium">
                Linked to job
                {selectedJob?.service_name ? `: ${selectedJob.service_name}` : ''}
              </p>
              {selectedJob?.customer_name && (
                <p className="mt-0.5 text-xs text-indigo-800">{selectedJob.customer_name}</p>
              )}
              {selectedJob?.start_at && (
                <p className="mt-1 text-xs text-indigo-900">
                  Finish before <strong>{formatWhen(selectedJob.start_at)}</strong>
                </p>
              )}
            </div>
          ) : (
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
          )}

          {!jobLocked && selectedJob && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
              Finish before <strong>{formatWhen(selectedJob.start_at)}</strong>
            </p>
          )}

          <label className="block text-sm font-medium text-slate-700">
            {selectedJob || jobLocked ? 'Complete by' : 'Deadline (optional)'}
            <input
              type="datetime-local"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm"
            />
          </label>

          {!selectedJob && !jobLocked && (
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
            className="lx-btn-primary w-full min-h-[48px] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save task'}
          </button>
        </form>
      )}
    </div>
  );
}
