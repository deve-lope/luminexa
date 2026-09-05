import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TaskListItem from './TaskListItem';
import { jobsAPI } from '../../utils/api';
import { withReturnTo } from '../../utils/navigationBack';
import { providerAddTask, providerScheduleDetail } from '../../utils/providerPaths';
import { parseApiError } from '../../utils/taskDisplay';

/**
 * Tasks for a booking: empty state, checkboxes, completed = strikethrough.
 */
export default function BookingTasksSection({ orgSlug, bookingId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!orgSlug || !bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await jobsAPI.listTasks({
        organization: orgSlug,
        job: bookingId,
      });
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(parseApiError(e));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [orgSlug, bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTask = async (task) => {
    setError(null);
    const nextDone = !task.is_done;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, is_done: nextDone, done_at: nextDone ? new Date().toISOString() : null }
          : t
      )
    );
    try {
      await jobsAPI.patchTask(task.id, { is_done: nextDone });
    } catch (e) {
      setError(parseApiError(e));
      await load();
    }
  };

  const bookingPath = providerScheduleDetail(orgSlug, 'booking', bookingId);
  const addTaskTo = withReturnTo(providerAddTask(orgSlug, bookingId), bookingPath);

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Tasks</h2>
        <Link to={addTaskTo} className="text-sm font-medium text-luminexa-accent">
          Add task
        </Link>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : !tasks.length ? (
        <p className="mt-4 text-sm text-slate-500">No tasks</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {tasks.map((task) => (
            <TaskListItem key={task.id} task={task} onToggle={toggleTask} hideJobLabel />
          ))}
        </ul>
      )}
    </section>
  );
}
