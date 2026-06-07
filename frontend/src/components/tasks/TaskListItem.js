import React from 'react';
import {
  RECURRENCE_LABEL,
  formatTaskDue,
  isJobPrepTask,
  isTaskOverdue,
  jobPrepLabel,
} from '../../utils/taskDisplay';

export default function TaskListItem({ task, onToggle }) {
  const overdue = isTaskOverdue(task);
  const dueLabel = formatTaskDue(task);
  const prep = isJobPrepTask(task);

  return (
    <li
      className={`flex items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 ${
        task.is_done ? 'bg-slate-50' : overdue ? 'border-red-100 bg-red-50' : 'bg-white ring-1 ring-slate-100'
      }`}
    >
      <input
        type="checkbox"
        checked={task.is_done}
        onChange={() => onToggle(task)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300"
        aria-label={task.is_done ? 'Mark incomplete' : 'Mark done'}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            task.is_done ? 'text-slate-400 line-through' : 'text-slate-900'
          } ${!task.is_done && overdue ? 'text-red-900' : ''}`}
        >
          {task.title}
        </p>
        {(dueLabel || prep || (task.recurrence && task.recurrence !== 'none')) && (
          <p className="mt-0.5 text-xs text-slate-500">
            {prep && <span className="text-indigo-600">{jobPrepLabel(task)} · </span>}
            {dueLabel && (
              <span className={overdue && !task.is_done ? 'font-medium text-red-600' : ''}>
                {overdue && !task.is_done ? 'Overdue · ' : 'Due '}
                {dueLabel}
              </span>
            )}
            {task.recurrence && task.recurrence !== 'none' && (
              <span className="ml-1 text-violet-600">{RECURRENCE_LABEL[task.recurrence]}</span>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
