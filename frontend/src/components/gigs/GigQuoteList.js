import React from 'react';
import GigQuoteCard from './GigQuoteCard';

export default function GigQuoteList({
  quotes = [],
  loading = false,
  emptyForProvider = false,
  highlightLowest = false,
  onOpenQuote,
}) {
  const lowestId =
    highlightLowest && quotes.length
      ? quotes.reduce((best, q) => {
          if (!best) return q;
          return Number(q.price) < Number(best.price) ? q : best;
        }, null)?.id
      : null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          Bids ({quotes.length})
        </h2>
        {!emptyForProvider && quotes.length > 0 && (
          <p className="text-sm text-slate-500">Tap a bid to accept, reject, negotiate, or message</p>
        )}
      </div>
      {loading && <p className="text-sm text-slate-500">Loading bids…</p>}
      {!loading && quotes.length === 0 && (
        <div className="gig-empty-board py-8">
          <p className="text-sm text-slate-600">
            {emptyForProvider
              ? 'You have not placed a bid yet.'
              : 'No bids yet. Providers will send bids soon.'}
          </p>
        </div>
      )}
      {!loading &&
        quotes.map((quote) => (
          <GigQuoteCard
            key={quote.id}
            quote={quote}
            isLowest={highlightLowest && quote.id === lowestId && quotes.length > 1}
            onOpen={onOpenQuote}
          />
        ))}
    </div>
  );
}
