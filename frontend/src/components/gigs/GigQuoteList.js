import React from 'react';
import GigQuoteCard from './GigQuoteCard';

export default function GigQuoteList({
  quotes = [],
  canAccept = false,
  onAcceptQuote,
  loading = false,
  noun = 'quote',
}) {
  const plural = noun === 'bid' ? 'bids' : 'quotes';
  const heading = noun === 'bid' ? 'Bids' : 'Quotes';
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          {heading} ({quotes.length})
        </h2>
        {noun === 'quote' && (
          <p className="text-sm text-slate-500">Sorted by price — lowest first</p>
        )}
      </div>
      {loading && <p className="text-sm text-slate-500">Loading {plural}…</p>}
      {!loading && quotes.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          {noun === 'bid'
            ? 'You have not placed a bid yet.'
            : 'No quotes yet. Providers will send quotes soon.'}
        </p>
      )}
      {!loading &&
        quotes.map((quote) => (
          <GigQuoteCard
            key={quote.id}
            quote={quote}
            showAcceptButton={canAccept && quote.status === 'submitted'}
            onAccept={onAcceptQuote}
          />
        ))}
    </div>
  );
}
