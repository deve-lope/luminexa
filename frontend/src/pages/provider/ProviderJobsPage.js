import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import InvoicePanel from '../../components/booking/InvoicePanel';
import TaskListItem from '../../components/tasks/TaskListItem';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import { withReturnTo } from '../../utils/navigationBack';
import {
  providerAddTask,
  providerJobs,
  providerRequestDetail,
  providerScheduleDetail,
} from '../../utils/providerPaths';
import { requestStatusLabel, requestStatusTone } from '../../utils/requestStatus';
import parseApiError from '../../utils/parseApiError';

const FILTERS = [
  { key: 'active', label: 'Upcoming' },
  { key: 'done', label: 'Completed' },
];

function StatusBadge({ kind, status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${requestStatusTone(kind, status)}`}
    >
      {requestStatusLabel(kind, status)}
    </span>
  );
}

function jobDetailPath(orgSlug, item) {
  const jobsHome = providerJobs(orgSlug);
  if (item.kind === 'booking') {
    return withReturnTo(providerScheduleDetail(orgSlug, 'booking', item.id), jobsHome);
  }
  return withReturnTo(providerRequestDetail(orgSlug, item.kind, item.id), jobsHome);
}

function sortJobs(items, filter) {
  const rows = [...(items || [])];
  if (filter === 'active') {
    rows.sort((a, b) => {
      const aOpen = a.open_task_count || 0;
      const bOpen = b.open_task_count || 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
      const aTime = a.start_at ? new Date(a.start_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.start_at ? new Date(b.start_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  } else {
    rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }
  return rows;
}

export default function ProviderJobsPage() {
  const { orgSlug, activeOrg } = useProviderOrg();
  const [filter, setFilter] = useState('active');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [taskError, setTaskError] = useState(null);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await jobsAPI.listProviderServiceRequests(orgSlug, { filter });
      setItems(res.data?.items || []);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [orgSlug, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => sortJobs(items, filter), [items, filter]);
  const providerName = activeOrg?.organization_name;

  const toggleTask = async (item, task) => {
    setTaskError(null);
    try {
      await jobsAPI.patchTask(task.id, { is_done: !task.is_done });
      setItems((prev) =>
        prev.map((row) => {
          if (row.kind !== item.kind || row.id !== item.id) return row;
          const nextDone = !task.is_done;
          if (nextDone) {
            const open_tasks = (row.open_tasks || []).filter((t) => t.id !== task.id);
            return {
              ...row,
              open_tasks,
              open_task_count: Math.max(0, (row.open_task_count || 0) - 1),
            };
          }
          return row;
        }),
      );
    } catch (e) {
      setTaskError(parseApiError(e));
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <p className="text-sm text-slate-600">
        Bookings you have accepted — confirmed, in progress, and completed.
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
              filter === key
                ? 'lx-toggle-active'
                : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      {taskError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{taskError}</p>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
          <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm">Loading jobs…</p>
        </div>
      )}

      {!loading && !sorted.length && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="font-semibold text-slate-900">
            {filter === 'done' ? 'No completed jobs yet' : 'No upcoming jobs'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {filter === 'done'
              ? 'Finished jobs will show up here after you mark them complete.'
              : 'When you approve a request, the confirmed job appears here.'}
          </p>
        </div>
      )}

      {!loading && !!sorted.length && (
        <ul className="space-y-3">
          {sorted.map((item) => {
            const openCount = item.open_task_count || 0;
            const openTasks = item.open_tasks || [];
            return (
              <li key={`${item.kind}-${item.id}`} className="lx-card space-y-3 p-4">
                <Link
                  to={jobDetailPath(orgSlug, item)}
                  className="flex items-start gap-3 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <StatusBadge kind={item.kind} status={item.status} />
                      {openCount > 0 && (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
                          {openCount} open task{openCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {item.customer_name}
                      {item.reference && (
                        <span className="ml-2 font-mono text-xs text-slate-400">{item.reference}</span>
                      )}
                    </p>
                    {item.start_at && (
                      <p className="mt-1.5 text-sm text-slate-500">{formatWhen(item.start_at)}</p>
                    )}
                    {!item.start_at && item.preferred_date && (
                      <p className="mt-1.5 text-sm text-slate-500">Preferred: {item.preferred_date}</p>
                    )}
                    {item.summary && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{item.summary}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                      <span>{item.kind === 'booking' ? 'Booking' : 'Custom request'}</span>
                      {item.message_count > 0 && (
                        <span>· {item.message_count} message{item.message_count === 1 ? '' : 's'}</span>
                      )}
                    </div>
                  </div>
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                {item.kind === 'booking' && (openCount > 0 || filter === 'active') && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    {openCount > 0 ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Incomplete tasks
                          </p>
                          <Link
                            to={withReturnTo(
                              providerAddTask(orgSlug, item.id),
                              providerScheduleDetail(orgSlug, 'booking', item.id),
                            )}
                            className="text-xs font-medium text-luminexa-accent"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Add task
                          </Link>
                        </div>
                        <ul className="space-y-1.5">
                          {openTasks.map((task) => (
                            <TaskListItem
                              key={task.id}
                              task={task}
                              onToggle={(t) => toggleTask(item, t)}
                            />
                          ))}
                        </ul>
                        {openCount > openTasks.length && (
                          <p className="text-xs text-slate-500">
                            +{openCount - openTasks.length} more — open the job to manage all tasks
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-500">No open tasks for this job</p>
                        <Link
                          to={withReturnTo(
                            providerAddTask(orgSlug, item.id),
                            providerScheduleDetail(orgSlug, 'booking', item.id),
                          )}
                          className="text-xs font-medium text-luminexa-accent"
                        >
                          Add task
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {item.invoice && (
                  <InvoicePanel
                    compact
                    invoice={item.invoice}
                    bookingId={item.id}
                    providerName={item.invoice.provider_name || providerName}
                  />
                )}
                {filter === 'done' && item.kind === 'booking' && item.status === 'completed' && !item.invoice && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Completed — no invoice on file yet. Open the booking to issue one.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
