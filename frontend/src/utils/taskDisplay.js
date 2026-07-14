import { formatWhen } from './datetime';

export const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const RECURRENCE_LABEL = {
  none: 'One-time',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export function isTaskOverdue(task) {
  if (!task || task.is_done || !task.due_at) return false;
  return new Date(task.due_at).getTime() < Date.now();
}

export function formatTaskDue(task) {
  if (!task?.due_at) return null;
  return formatWhen(task.due_at);
}

/** Task is tied to a confirmed/upcoming booking (prep before leaving). */
export function isJobPrepTask(task) {
  return Boolean(task?.job);
}

export function jobPrepLabel(task) {
  if (!task?.job) return null;
  const parts = [task.job_service_name, task.job_customer_name].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Linked job';
}

export function parseApiError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Something went wrong.';
}
