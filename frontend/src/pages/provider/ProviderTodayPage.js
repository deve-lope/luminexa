import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import TaskListItem from '../../components/tasks/TaskListItem';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import {
  providerAddTask,
  providerNotifications,
  providerSchedule,
  providerTasks,
} from '../../utils/providerPaths';
import { businessesAPI, jobsAPI } from '../../utils/api';
import { formatTime, formatWhen } from '../../utils/datetime';
import { parseApiError } from '../../utils/taskDisplay';

function jobAccent(status) {
  if (status === 'in_progress') return 'from-violet-500 to-indigo-600';
  return 'from-luminexa-accent to-violet-600';
}

export default function ProviderTodayPage() {
  const { orgSlug } = useProviderOrg();
  const [dashboard, setDashboard] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setFetching(true);
    setError(null);
    try {
      const res = await jobsAPI.getProviderDashboard(orgSlug);
      setDashboard(res.data);
    } catch (e) {
      setError(parseApiError(e));
      setDashboard(null);
    } finally {
      setFetching(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!orgSlug) return undefined;
    const intervalId = window.setInterval(load, 60000);
    return () => window.clearInterval(intervalId);
  }, [orgSlug, load]);

  const { openTasks, doneTasks } = useMemo(() => {
    const list = dashboard?.tasks || [];
    const open = list.filter((t) => !t.is_done);
    const done = list.filter((t) => t.is_done);
    const byDue = (a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at) - new Date(b.due_at);
    };
    open.sort(byDue);
    return { openTasks: open, doneTasks: done };
  }, [dashboard?.tasks]);

  const toggleTask = async (task) => {
    try {
      await jobsAPI.patchTask(task.id, { is_done: !task.is_done });
      await load();
    } catch (e) {
      setError(parseApiError(e));
    }
  };

  const dismissInquiry = async (id) => {
    try {
      await businessesAPI.dismissServiceInquiry(orgSlug, id);
      load();
    } catch {
      setError('Could not dismiss inquiry.');
    }
  };

  const dismissNotification = async (id) => {
    try {
      await jobsAPI.dismissNotification(orgSlug, id);
      load();
    } catch {
      setError('Could not dismiss notification.');
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (!orgSlug || (fetching && !dashboard)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <p className="text-slate-600">{error || 'Could not load dashboard.'}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 min-h-[44px] rounded-lg bg-luminexa-accent px-4 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  const stats = dashboard.stats || {};
  const jobs = dashboard.upcoming_jobs || [];
  const moreJobs = Math.max(0, (stats.upcoming_count ?? jobs.length) - jobs.length);
  const moreOpenTasks = Math.max(0, (stats.tasks_open_total ?? 0) - (stats.tasks_open_shown ?? 0));
  const moreDoneTasks = Math.max(0, (stats.tasks_done_total ?? 0) - (stats.tasks_done_shown ?? 0));
  const moreTasksTotal = moreOpenTasks + moreDoneTasks;

  return (
    <div className="space-y-5 pb-8">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <header className="rounded-2xl bg-gradient-to-br from-luminexa-navy to-violet-900 p-5 text-white">
        <p className="text-sm text-violet-200">{greeting()}</p>
        <h1 className="mt-0.5 text-xl font-bold">{dashboard.organization?.name}</h1>
        <p className="text-sm text-white/70">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/10 py-2">
            <p className="text-lg font-bold">{stats.jobs_today ?? 0}</p>
            <p className="text-[10px] uppercase text-white/70">Today</p>
          </div>
          <div className="rounded-lg bg-white/10 py-2">
            <p className="text-lg font-bold">{stats.upcoming_count ?? 0}</p>
            <p className="text-[10px] uppercase text-white/70">Upcoming</p>
          </div>
          <div className="rounded-lg bg-white/10 py-2">
            <p className="text-lg font-bold">{stats.pending_requests_count ?? 0}</p>
            <p className="text-[10px] uppercase text-white/70">Requests</p>
          </div>
        </div>
      </header>

      {(dashboard.notifications || []).map((n) => (
        <div
          key={n.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"
        >
          <div>
            <p className="font-medium text-amber-900">{n.message}</p>
            <Link to={providerSchedule(orgSlug)} className="mt-1 inline-block text-luminexa-accent">
              Open schedule
            </Link>
          </div>
          <button type="button" onClick={() => dismissNotification(n.id)} className="text-xs text-amber-800">
            Dismiss
          </button>
        </div>
      ))}

      {!!dashboard.pending_requests?.length && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            {dashboard.pending_requests.length} booking request
            {dashboard.pending_requests.length === 1 ? '' : 's'}
          </p>
          <Link
            to={providerNotifications(orgSlug)}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white"
          >
            Review
          </Link>
        </div>
      )}

      <section className="rounded-xl bg-white p-4 ring-1 ring-slate-100">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Tasks</h2>
          <Link
            to={providerAddTask(orgSlug)}
            className="rounded-lg bg-luminexa-accent px-3 py-2 text-sm font-medium text-white"
          >
            Add task
          </Link>
        </div>
        {!openTasks.length && !doneTasks.length ? (
          <p className="mt-3 text-sm text-slate-500">No tasks yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {!!openTasks.length && (
              <ul className="space-y-2">
                {openTasks.map((task) => (
                  <TaskListItem key={task.id} task={task} onToggle={toggleTask} />
                ))}
              </ul>
            )}
            {!!doneTasks.length && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Done
                </p>
                <ul className="space-y-2">
                  {doneTasks.map((task) => (
                    <TaskListItem key={task.id} task={task} onToggle={toggleTask} />
                  ))}
                </ul>
              </div>
            )}
            {moreTasksTotal > 0 && (
              <p className="text-center text-xs text-slate-500">
                <Link to={providerTasks(orgSlug)} className="font-medium text-luminexa-accent">
                  View all tasks (+{moreTasksTotal} more)
                </Link>
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Upcoming jobs</h2>
          <Link to={providerSchedule(orgSlug)} className="text-sm text-luminexa-accent">
            Schedule
          </Link>
        </div>
        {!jobs.length ? (
          <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-100">
            No upcoming jobs.
          </p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-100"
              >
                <div className={`h-1 bg-gradient-to-r ${jobAccent(job.status)}`} />
                <div className="flex gap-3 p-3">
                  <div className="shrink-0 text-center">
                    <p className="text-[10px] font-medium uppercase text-slate-500">
                      {new Date(job.start_at).toLocaleDateString(undefined, { weekday: 'short' })}
                    </p>
                    <p className="text-base font-bold text-slate-900">
                      {new Date(job.start_at).getDate()}
                    </p>
                    <p className="text-xs text-slate-600">{formatTime(job.start_at)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{job.service_name}</p>
                    <p className="text-sm text-slate-600">{job.customer_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatWhen(job.start_at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {moreJobs > 0 && (
          <p className="mt-2 text-center text-xs text-slate-500">
            <Link to={providerSchedule(orgSlug)} className="font-medium text-luminexa-accent">
              +{moreJobs} more in the next {stats.upcoming_window_days ?? 14} days — open schedule
            </Link>
          </p>
        )}
      </section>

      {!!dashboard.customer_inquiries?.length && (
        <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <h2 className="text-sm font-semibold text-violet-900">Customer messages</h2>
          <ul className="mt-2 space-y-2">
            {dashboard.customer_inquiries.map((inq) => (
              <li key={inq.id} className="rounded-lg bg-white p-3 text-sm">
                {inq.service_label && <p className="font-medium">{inq.service_label}</p>}
                {inq.preferred_date && (
                  <p className="text-xs text-slate-500">Preferred date: {inq.preferred_date}</p>
                )}
                <p className="text-slate-700">{inq.message}</p>
                <button
                  type="button"
                  onClick={() => dismissInquiry(inq.id)}
                  className="mt-2 text-xs font-medium text-luminexa-accent"
                >
                  Mark handled
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
