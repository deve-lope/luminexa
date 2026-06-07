import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import TaskListItem from '../../components/tasks/TaskListItem';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { providerAddTask } from '../../utils/providerPaths';
import { jobsAPI } from '../../utils/api';
import { parseApiError } from '../../utils/taskDisplay';

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];

export default function ProviderTasksPage() {
  const { orgSlug } = useProviderOrg();
  const [filter, setFilter] = useState('open');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);
    try {
      const params = { organization: orgSlug };
      if (filter === 'open') params.is_done = 'false';
      if (filter === 'done') params.is_done = 'true';
      const res = await jobsAPI.listTasks(params);
      setTasks(res.data || []);
    } catch (e) {
      setError(parseApiError(e));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [orgSlug, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const { openTasks, doneTasks } = useMemo(() => {
    if (filter === 'open') return { openTasks: tasks, doneTasks: [] };
    if (filter === 'done') return { openTasks: [], doneTasks: tasks };
    return {
      openTasks: tasks.filter((t) => !t.is_done),
      doneTasks: tasks.filter((t) => t.is_done),
    };
  }, [tasks, filter]);

  const toggleTask = async (task) => {
    try {
      await jobsAPI.patchTask(task.id, { is_done: !task.is_done });
      await load();
    } catch (e) {
      setError(parseApiError(e));
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-end gap-2">
        <Link
          to={providerAddTask(orgSlug)}
          className="rounded-lg bg-luminexa-accent px-3 py-2 text-sm font-medium text-white"
        >
          Add task
        </Link>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f.id
                ? 'bg-luminexa-navy text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading tasks…</p>
      ) : !openTasks.length && !doneTasks.length ? (
        <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-100">
          {filter === 'done' ? 'No completed tasks yet.' : 'No tasks yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {!!openTasks.length && (
            <section className="rounded-xl bg-white p-4 ring-1 ring-slate-100">
              {filter === 'all' && (
                <h2 className="mb-2 text-sm font-semibold text-slate-900">Open</h2>
              )}
              <ul className="space-y-2">
                {openTasks.map((task) => (
                  <TaskListItem key={task.id} task={task} onToggle={toggleTask} />
                ))}
              </ul>
            </section>
          )}
          {!!doneTasks.length && (
            <section className="rounded-xl bg-white p-4 ring-1 ring-slate-100">
              {filter === 'all' && (
                <h2 className="mb-2 text-sm font-semibold text-slate-900">Done</h2>
              )}
              <ul className="space-y-2">
                {doneTasks.map((task) => (
                  <TaskListItem key={task.id} task={task} onToggle={toggleTask} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
