import React from 'react';
import StarRating from './StarRating';

const DIMENSION_LABELS = {
  communication: 'Communication',
  price: 'Price',
  punctual: 'Punctual',
  quality: 'Quality of work',
};

export default function ServiceRatingSummary({
  summary,
  showBreakdown = false,
  compact = false,
  onDark = false,
}) {
  if (!summary || !summary.count) {
    return (
      <p className={`text-sm ${onDark ? 'text-white/70' : 'text-slate-500'}`}>No ratings yet</p>
    );
  }

  if (compact) {
    return (
      <p className={`flex items-center gap-1.5 text-sm ${onDark ? 'text-white/90' : 'text-slate-600'}`}>
        <StarRating value={summary.average} size="sm" />
        <span className={`font-medium ${onDark ? 'text-white' : 'text-slate-800'}`}>
          {summary.average}
        </span>
        <span className={onDark ? 'text-white/80' : 'text-slate-500'}>
          ({summary.count} {summary.count === 1 ? 'rating' : 'ratings'})
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xl font-bold text-slate-900">{summary.average}</span>
        <StarRating value={summary.average} size="lg" />
        <span className="text-sm text-slate-500">
          {summary.count} {summary.count === 1 ? 'rating' : 'ratings'}
        </span>
      </div>
      {showBreakdown && (
        <ul className="space-y-2">
          {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
            <li key={key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">{label}</span>
              <span className="flex items-center gap-2">
                <StarRating value={summary[key]} size="sm" />
                <span className="w-8 text-right font-medium text-slate-800">
                  {summary[key] ?? '—'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
