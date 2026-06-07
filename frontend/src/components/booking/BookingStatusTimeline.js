import React from 'react';
import { formatWhen } from '../../utils/datetime';

const ACTION_LABELS = {
  created: 'Booking created',
  accepted: 'Accepted by provider',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Marked complete',
  rescheduled: 'Rescheduled',
  no_show: 'Marked no-show',
};

export default function BookingStatusTimeline({ events }) {
  if (!events?.length) {
    return <p className="text-sm text-slate-500">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
      {events.map((ev) => (
        <li key={ev.id} className="relative">
          <span className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-luminexa-accent ring-2 ring-white" />
          <p className="text-sm font-medium text-slate-900">
            {ACTION_LABELS[ev.action] || ev.action}
          </p>
          <p className="text-xs text-slate-500">
            {ev.actor_name} · {formatWhen(ev.created_at)}
          </p>
          {ev.note && <p className="mt-0.5 text-xs text-slate-600">{ev.note}</p>}
        </li>
      ))}
    </ol>
  );
}
