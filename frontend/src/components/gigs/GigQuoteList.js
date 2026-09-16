import React from 'react';
import GigQuoteCard from './GigQuoteCard';

export default function GigQuoteList({
  quotes = [],
  canAccept = false,
  onAcceptQuote,
  loading = false,
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Quotes ({quotes.length})</h2>
        <p className="text-sm text-slate-500">Sorted by price — lowest first</p>
      </div>
      {loading && <p className="text-sm text-slate-500">Loading quotes…</p>}
      {!loading && quotes.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          No quotes yet. Providers will submit quotes soon.
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
