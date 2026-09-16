import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function GigQuoteCard({ quote, showAcceptButton = false, onAccept }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const org = quote.organization || {};

  const handleAccept = async () => {
    setBusy(true);
    try {
      await onAccept?.(quote.id);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {org.logo && (
              <img src={org.logo} alt="" className="h-8 w-8 rounded-full object-cover" />
            )}
            {org.slug ? (
              <Link to={`/book/${org.slug}`} className="font-semibold text-slate-900 hover:underline">
                {org.name}
              </Link>
            ) : (
              <span className="font-semibold text-slate-900">{org.name || 'Provider'}</span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{quote.description}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {quote.estimated_duration_days != null && (
              <span>Est. {quote.estimated_duration_days} day(s)</span>
            )}
            {quote.organization_distance != null && (
              <span>{quote.organization_distance} mi away</span>
            )}
            {quote.organization_rating != null && (
              <span>★ {quote.organization_rating}</span>
            )}
            {quote.status === 'accepted' && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
                Accepted
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-bold text-slate-900">${quote.price}</div>
          {showAcceptButton && quote.status === 'submitted' && !confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              Accept
            </button>
          )}
        </div>
      </div>
      {confirming && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="text-emerald-900">
            Accept this quote for ${quote.price}? This closes the gig post.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleAccept}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Accepting…' : 'Confirm'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
