const BOOKING_LABELS = {
  requested: 'Awaiting response',
  quoted: 'Quote ready',
  confirmed: 'Approved',
  in_progress: 'In progress',
  needs_return: 'Needs return visit',
  completed: 'Done',
  cancelled: 'Declined',
};

const INQUIRY_LABELS = {
  pending: 'Awaiting approval',
  active: 'In progress',
  quoted: 'Quote ready',
  quote_accepted: 'Pick a time',
  completed: 'Done',
  declined: 'Declined',
};

const BOOKING_TONES = {
  requested: 'bg-amber-100 text-amber-900',
  quoted: 'bg-violet-100 text-violet-900',
  confirmed: 'bg-emerald-100 text-emerald-900',
  in_progress: 'bg-sky-100 text-sky-900',
  needs_return: 'bg-orange-100 text-orange-900',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-red-100 text-red-800',
};

const INQUIRY_TONES = {
  pending: 'bg-amber-100 text-amber-900',
  active: 'bg-sky-100 text-sky-900',
  quoted: 'bg-violet-100 text-violet-900',
  quote_accepted: 'bg-teal-100 text-teal-900',
  completed: 'bg-slate-100 text-slate-700',
  declined: 'bg-red-100 text-red-800',
};

export function requestStatusLabel(kind, status) {
  if (kind === 'inquiry') return INQUIRY_LABELS[status] || status;
  return BOOKING_LABELS[status] || status?.replace('_', ' ');
}

export function requestStatusTone(kind, status) {
  if (kind === 'inquiry') return INQUIRY_TONES[status] || 'bg-slate-100 text-slate-700';
  return BOOKING_TONES[status] || 'bg-slate-100 text-slate-700';
}

export function requestFilterLabel(filter) {
  const labels = {
    all: 'All',
    pending: 'Pending',
    active: 'Jobs',
    done: 'Completed',
  };
  return labels[filter] || filter;
}
