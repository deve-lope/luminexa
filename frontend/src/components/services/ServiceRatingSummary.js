import React from 'react';

const DIMENSION_LABELS = {
  communication: 'Communication',
  price: 'Price',
  punctual: 'Punctual',
  quality: 'Quality of work',
};

function StarRow({ value, max = 5 }) {
  const rounded = value != null ? Math.round(value * 2) / 2 : 0;
  return (
    <span className="inline-flex gap-0.5 text-amber-400" aria-hidden>
      {Array.from({ length: max }, (_, i) => {
        const filled = rounded >= i + 1;
        const half = !filled && rounded >= i + 0.5;
        return (
          <span key={i} className={filled || half ? 'opacity-100' : 'opacity-25'}>
            {half ? '★' : '★'}
          </span>
        );
      })}
    </span>
  );
}

export default function ServiceRatingSummary({
  summary,
  showBreakdown = false,
  compact = false,
}) {
  if (!summary || !summary.count) {
    return (
      <p className="text-sm text-slate-500">No ratings yet</p>
    );
  }

  if (compact) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-slate-600">
        <StarRow value={summary.average} />
        <span className="font-medium text-slate-800">{summary.average}</span>
        <span className="text-slate-500">
          ({summary.count} {summary.count === 1 ? 'rating' : 'ratings'})
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xl font-bold text-slate-900">{summary.average}</span>
        <StarRow value={summary.average} />
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
                <StarRow value={summary[key]} />
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
