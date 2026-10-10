import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TaskListItem from '../../components/tasks/TaskListItem';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import {
  providerAddTask,
  providerAnalytics,
  providerRequestDetail,
  providerRequests,
  providerSchedule,
  providerScheduleDetail,
  providerServices,
  providerSettings,
  providerShare,
  providerTasks,
  providerGigs,
} from '../../utils/providerPaths';
import { requestStatusLabel } from '../../utils/requestStatus';
import {
  PROVIDER_NOTIFICATIONS_CHANGED_EVENT,
  dismissProviderNotificationQuietly,
  emitProviderNotificationsChanged,
  providerNotificationCtaLabel,
  providerNotificationDestination,
} from '../../utils/providerNotifications';
import { jobsAPI } from '../../utils/api';
import { formatTime, formatWhen } from '../../utils/datetime';
import { parseApiError } from '../../utils/taskDisplay';
import { hasFinishedProviderSetupWizard } from '../../utils/profileSetup';
import { buildProviderSetupChecklist } from '../../utils/providerSetupChecklist';
import ProviderSetupProgressCard from '../../components/provider/ProviderSetupProgressCard';
import { useAuth } from '../../contexts/AuthContext';

function jobAccent(status) {
  if (status === 'in_progress') return 'from-violet-500 to-violet-700';
  if (status === 'needs_return') return 'from-amber-500 to-orange-600';
  return 'from-luminexa-accent to-violet-600';
}

export default function ProviderTodayPage() {
  const { orgSlug } = useProviderOrg();
  const navigate = useNavigate();
  const { memberships } = useAuth();
  const isOwner = useMemo(
    () => memberships?.some((m) => m.organization_slug === orgSlug && m.role === 'owner'),
    [memberships, orgSlug]
  );
  const [dashboard, setDashboard] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [showSetupHint, setShowSetupHint] = useState(false);
  const [orgDetails, setOrgDetails] = useState(null);
  const [servicesCount, setServicesCount] = useState(null);

  const [openTasksExpanded, setOpenTasksExpanded] = useState(false);
  const [expandedOpenTasks, setExpandedOpenTasks] = useState(null);
  const [expandingOpen, setExpandingOpen] = useState(false);

  useEffect(() => {
    if (!orgSlug || !isOwner) {
      setShowSetupHint(false);
      return;
    }
    setShowSetupHint(!hasFinishedProviderSetupWizard(orgSlug));
  }, [orgSlug, isOwner]);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setFetching(true);
    setError(null);
    try {
      const [dashRes, orgRes, servicesRes] = await Promise.all([
        jobsAPI.getProviderDashboard(orgSlug),
        isOwner ? jobsAPI.getOrganization(orgSlug).catch(() => null) : Promise.resolve(null),
        isOwner
          ? jobsAPI.listServices({ organization: orgSlug }).catch(() => null)
          : Promise.resolve(null),
      ]);
      setDashboard(dashRes.data);
      if (orgRes?.data) setOrgDetails(orgRes.data);
      const svc = servicesRes?.data;
      const count = Array.isArray(svc)
        ? svc.length
        : Array.isArray(svc?.results)
          ? svc.results.length
          : null;
      setServicesCount(count);
    } catch (e) {
      setError(parseApiError(e));
      setDashboard(null);
    } finally {
      setFetching(false);
    }
  }, [orgSlug, isOwner]);

  const setupChecklist = useMemo(() => {
    if (!showSetupHint || !orgSlug) return null;
    return buildProviderSetupChecklist({
      orgSlug,
      org: orgDetails,
      servicesCount,
      schedulingMode: orgDetails?.scheduling_mode || dashboard?.organization?.scheduling_mode,
    });
  }, [showSetupHint, orgSlug, orgDetails, servicesCount, dashboard]);

  useEffect(() => {
    load();
    setOpenTasksExpanded(false);
    setExpandedOpenTasks(null);
  }, [load]);

  useEffect(() => {
    if (!orgSlug) return undefined;
    const intervalId = window.setInterval(load, 60000);
    return () => window.clearInterval(intervalId);
  }, [orgSlug, load]);

  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener(PROVIDER_NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PROVIDER_NOTIFICATIONS_CHANGED_EVENT, onChanged);
  }, [load]);

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

  const loadMoreOpenTasks = async () => {
    if (!orgSlug) return;
    setExpandingOpen(true);
    try {
      const res = await jobsAPI.listTasks({ organization: orgSlug, is_done: 'false' });
      setExpandedOpenTasks(res.data || []);
      setOpenTasksExpanded(true);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setExpandingOpen(false);
    }
  };

  const collapseOpenTasks = () => {
    setOpenTasksExpanded(false);
    setExpandedOpenTasks(null);
  };

  const toggleTask = async (task) => {
    try {
      await jobsAPI.patchTask(task.id, { is_done: !task.is_done });
      await load();
      if (openTasksExpanded && orgSlug) {
        const res = await jobsAPI.listTasks({ organization: orgSlug, is_done: 'false' });
        setExpandedOpenTasks(res.data || []);
      }
    } catch (e) {
      setError(parseApiError(e));
    }
  };

  const removeNotificationLocally = (id) => {
    setDashboard((prev) =>
      prev
        ? {
            ...prev,
            notifications: (prev.notifications || []).filter((n) => n.id !== id),
          }
        : prev,
    );
  };

  const dismissNotification = async (id) => {
    removeNotificationLocally(id);
    try {
      await jobsAPI.dismissNotification(orgSlug, id);
      emitProviderNotificationsChanged();
    } catch {
      setError('Could not dismiss notification.');
      load();
    }
  };

  const openNotification = async (n) => {
    removeNotificationLocally(n.id);
    await dismissProviderNotificationQuietly(orgSlug, n.id);
    navigate(providerNotificationDestination(orgSlug, n));
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (!orgSlug || (fetching && !dashboard)) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <SkeletonList count={3} />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="lx-empty">
        <p className="text-slate-600">{error || 'Could not load dashboard.'}</p>
        <button type="button" onClick={load} className="lx-btn-primary mt-4">
          Try again
        </button>
      </div>
    );
  }

  const stats = dashboard.stats || {};
  const jobs = dashboard.upcoming_jobs || [];
  const needsReturnJobs = dashboard.needs_return_jobs || [];
  const moreJobs = Math.max(0, (stats.upcoming_count ?? jobs.length) - jobs.length);
  const moreOpenTasks = Math.max(0, (stats.tasks_open_total ?? 0) - (stats.tasks_open_shown ?? 0));
  const moreDoneTasks = Math.max(0, (stats.tasks_done_total ?? 0) - (stats.tasks_done_shown ?? 0));
  const visibleOpenTasks =
    openTasksExpanded && expandedOpenTasks ? expandedOpenTasks : openTasks;

  return (
    <div className="space-y-5 pb-8">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <header className="lx-hero">
        <div className="relative p-5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-400/20 blur-2xl" />
          <p className="text-sm text-violet-200">{greeting()}</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight">{dashboard.organization?.name}</h1>
          <p className="text-sm text-white/75">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/10 py-2 ring-1 ring-white/10 backdrop-blur-sm">
              <p className="text-lg font-bold">{stats.jobs_today ?? 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-white/70">Today</p>
            </div>
            <Link
              to={providerSchedule(orgSlug)}
              className="rounded-xl bg-white/10 py-2 ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-white/20"
            >
              <p className="text-lg font-bold">{stats.upcoming_count ?? 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-white/70">Upcoming</p>
            </Link>
            <Link
              to={providerRequests(
                orgSlug,
                (stats.pending_requests_count || 0) + (stats.customer_inquiries_count || 0) > 0
                  ? 'pending'
                  : undefined,
              )}
              className="rounded-xl bg-white/10 py-2 ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-white/20"
            >
              <p className="text-lg font-bold">
                {(stats.pending_requests_count ?? 0) + (stats.customer_inquiries_count ?? 0)}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-white/70">Requests</p>
            </Link>
          </div>
        </div>
      </header>

      {showSetupHint && setupChecklist && !setupChecklist.complete && (
        <ProviderSetupProgressCard
          orgSlug={orgSlug}
          checklist={setupChecklist}
          onDismiss={() => setShowSetupHint(false)}
        />
      )}

      {(dashboard.notifications || []).map((n) => (
        <div
          key={n.id}
          className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${
            n.kind === 'promo_offer'
              ? 'border-teal-200 bg-teal-50'
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          <button
            type="button"
            onClick={() => openNotification(n)}
            className="min-w-0 flex-1 text-left"
          >
            <p className={`font-medium ${n.kind === 'promo_offer' ? 'text-teal-900' : 'text-amber-900'}`}>
              {n.message}
            </p>
            <span className="mt-1 inline-block text-luminexa-accent">
              {providerNotificationCtaLabel(n)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => dismissNotification(n.id)}
            className={`text-xs ${n.kind === 'promo_offer' ? 'text-teal-800' : 'text-amber-800'}`}
          >
            Dismiss
          </button>
        </div>
      ))}

      {(() => {
        const pendingBookings = dashboard.pending_requests || [];
        const pendingInquiries = dashboard.customer_inquiries || [];
        const pendingCount = pendingBookings.length + pendingInquiries.length;
        if (!pendingCount) return null;
        return (
          <section
            id="lx-attention"
            className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {pendingCount} request{pendingCount === 1 ? '' : 's'} need your attention
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  These are waiting for your response
                </p>
              </div>
              <Link
                to={providerRequests(orgSlug, 'pending')}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white"
              >
                Review all
              </Link>
            </div>
            <ul className="space-y-2">
              {pendingBookings.map((b) => (
                <li key={`booking-${b.id}`}>
                  <Link
                    to={providerRequestDetail(orgSlug, 'booking', b.id)}
                    className="block rounded-lg border border-amber-200/80 bg-white px-3 py-2.5 shadow-sm ring-2 ring-amber-300/70 transition hover:border-amber-300"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">
                        {b.service_name || 'Booking request'}
                      </p>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                        {requestStatusLabel('booking', b.status)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {b.customer_name || b.customer_email || 'Customer'}
                    </p>
                    {b.start_at && (
                      <p className="mt-1 text-xs text-slate-500">{formatWhen(b.start_at)}</p>
                    )}
                  </Link>
                </li>
              ))}
              {pendingInquiries.map((inq) => (
                <li key={`inquiry-${inq.id}`}>
                  <Link
                    to={providerRequestDetail(orgSlug, 'inquiry', inq.id)}
                    className="block rounded-lg border border-amber-200/80 bg-white px-3 py-2.5 shadow-sm ring-2 ring-amber-300/70 transition hover:border-amber-300"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">
                        {inq.service_name || inq.service_label || 'Custom request'}
                      </p>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                        {requestStatusLabel('inquiry', inq.status)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {inq.customer_name || inq.customer_email || 'Customer'}
                    </p>
                    {inq.preferred_date && (
                      <p className="mt-1 text-xs text-slate-500">
                        Preferred: {inq.preferred_date}
                      </p>
                    )}
                    {inq.message && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{inq.message}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      <section className="lx-panel">
        <div className="flex items-center justify-between gap-2">
          <h2 className="lx-section-title">Tasks</h2>
          <Link to={providerAddTask(orgSlug)} className="lx-btn-primary min-h-[40px] px-3 py-2 text-sm">
            Add task
          </Link>
        </div>
        {!visibleOpenTasks.length && !doneTasks.length ? (
          <p className="mt-3 text-sm text-slate-500">No tasks yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {!!visibleOpenTasks.length && (
              <ul className="space-y-2">
                {visibleOpenTasks.map((task) => (
                  <TaskListItem key={task.id} task={task} onToggle={toggleTask} />
                ))}
              </ul>
            )}
            {moreOpenTasks > 0 && !openTasksExpanded && (
              <button
                type="button"
                onClick={loadMoreOpenTasks}
                disabled={expandingOpen}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-luminexa-accent disabled:opacity-60"
              >
                {expandingOpen ? 'Loading…' : `Show ${moreOpenTasks} more open task${moreOpenTasks === 1 ? '' : 's'}`}
              </button>
            )}
            {openTasksExpanded && (
              <button
                type="button"
                onClick={collapseOpenTasks}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium text-slate-600"
              >
                Show fewer open tasks
              </button>
            )}
            {!!doneTasks.length && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Done · last 2 days
                </p>
                <ul className="space-y-2">
                  {doneTasks.map((task) => (
                    <TaskListItem key={task.id} task={task} onToggle={toggleTask} />
                  ))}
                </ul>
              </div>
            )}
            {moreDoneTasks > 0 && (
              <p className="text-center text-xs text-slate-500">
                <Link
                  to={providerTasks(orgSlug, 'done')}
                  className="font-medium text-luminexa-accent"
                >
                  View {moreDoneTasks} more completed task{moreDoneTasks === 1 ? '' : 's'}
                </Link>
              </p>
            )}
            {(moreOpenTasks > 0 || moreDoneTasks > 0 || openTasksExpanded) && (
              <p className="text-center text-xs text-slate-500">
                <Link to={providerTasks(orgSlug)} className="font-medium text-luminexa-accent">
                  All tasks
                </Link>
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Jobs</h2>
          <Link to={providerSchedule(orgSlug)} className="text-sm text-luminexa-accent">
            Schedule
          </Link>
        </div>
        {!jobs.length ? (
          <p className="lx-empty py-6 text-sm text-slate-500">
            No jobs today or upcoming.
          </p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((job) => {
              const startMs = job.start_at ? new Date(job.start_at).getTime() : 0;
              const overdue =
                job.status === 'confirmed' && startMs > 0 && startMs < Date.now();
              return (
              <li key={job.id}>
                <Link
                  to={providerScheduleDetail(orgSlug, 'booking', job.id)}
                  className={`lx-card-interactive block overflow-hidden p-0 hover:ring-violet-100/80 ${
                    overdue ? 'ring-1 ring-amber-200' : ''
                  }`}
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
                      {overdue && (
                        <p className="mt-1 text-xs font-medium text-amber-800">
                          Start time passed — open to start or complete
                        </p>
                      )}
                    </div>
                    <div className="flex items-center text-slate-300">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                </Link>
              </li>
              );
            })}
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

      {needsReturnJobs.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Needs return visit</h2>
            <span className="text-xs font-medium text-amber-800">
              {stats.needs_return_count ?? needsReturnJobs.length}
            </span>
          </div>
          <ul className="space-y-2">
            {needsReturnJobs.map((job) => (
              <li key={job.id}>
                <Link
                  to={providerScheduleDetail(orgSlug, 'booking', job.id)}
                  className="lx-card-interactive block overflow-hidden p-0 ring-1 ring-amber-100 hover:ring-amber-200"
                >
                  <div className={`h-1 bg-gradient-to-r ${jobAccent(job.status)}`} />
                  <div className="flex gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{job.service_name}</p>
                      <p className="text-sm text-slate-600">{job.customer_name}</p>
                      <p className="mt-1 text-xs text-amber-800">
                        Incomplete · schedule follow-up
                      </p>
                    </div>
                    <div className="flex items-center text-slate-300">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold text-slate-900">Manage your business</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Analytics', to: providerAnalytics(orgSlug) },
            { label: 'Services', to: providerServices(orgSlug) },
            { label: 'Schedule', to: providerSchedule(orgSlug) },
            { label: 'Gig wall', to: providerGigs(orgSlug) },
            { label: 'My page', to: providerShare(orgSlug) },
            { label: 'Settings', to: providerSettings(orgSlug) },
          ].map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="lx-card-interactive flex min-h-[64px] items-center justify-center px-3 text-center text-sm font-medium text-slate-700 hover:ring-violet-100/80"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
