const BOOKING_LABELS = {
  requested: 'Awaiting approval',
  confirmed: 'Approved',
  in_progress: 'In progress',
  completed: 'Done',
  cancelled: 'Declined',
};

const INQUIRY_LABELS = {
  pending: 'Awaiting approval',
  active: 'Approved',
  completed: 'Done',
  declined: 'Declined',
};

const BOOKING_TONES = {
  requested: 'bg-amber-100 text-amber-900',
  confirmed: 'bg-emerald-100 text-emerald-900',
  in_progress: 'bg-sky-100 text-sky-900',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-red-100 text-red-800',
};

const INQUIRY_TONES = {
  pending: 'bg-amber-100 text-amber-900',
  active: 'bg-emerald-100 text-emerald-900',
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
    active: 'Active',
    done: 'Done',
  };
  return labels[filter] || filter;
}
