import React from 'react';

function statusBadge(status) {
  if (status === 'accepted') {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Accepted
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        Rejected
      </span>
    );
  }
  if (status === 'countered') {
    return (
      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
        Counter pending
      </span>
    );
  }
  if (status === 'withdrawn') {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        Withdrawn
      </span>
    );
  }
  return null;
}

export default function GigQuoteCard({
  quote,
  isLowest = false,
  onOpen,
}) {
  const org = quote.organization || {};

  return (
    <button
      type="button"
      onClick={() => onOpen?.(quote)}
      className={`gig-bid-card w-full text-left transition hover:-translate-y-0.5 hover:shadow-md${
        isLowest ? ' gig-bid-card--lowest' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {org.logo && (
              <img src={org.logo} alt="" className="h-8 w-8 rounded-full object-cover" />
            )}
            <span className="font-semibold text-slate-900">{org.name || 'Provider'}</span>
            {isLowest && (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                Lowest
              </span>
            )}
            {statusBadge(quote.status)}
          </div>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {quote.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quote.estimated_duration_days != null && (
              <span className="gig-pin-chip">Est. {quote.estimated_duration_days} day(s)</span>
            )}
            {quote.organization_distance != null && (
              <span className="gig-pin-chip">{quote.organization_distance} mi away</span>
            )}
            {quote.organization_rating != null && (
              <span className="gig-pin-chip">★ {quote.organization_rating}</span>
            )}
            {quote.counter_price != null && quote.status === 'countered' && (
              <span className="gig-pin-chip">Counter ${quote.counter_price}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">
            ${quote.price}
          </div>
          <p className="mt-1 text-xs font-semibold text-teal-700">View bid →</p>
        </div>
      </div>
    </button>
  );
}
