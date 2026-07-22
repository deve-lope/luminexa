import React from 'react';

/**
 * Visual 1–5 star row. Supports half stars (e.g. 4.5 → 4 full + 1 half-lit).
 */
export default function StarRating({
  value,
  max = 5,
  size = 'md',
  className = '',
}) {
  const n = Number(value);
  const rounded = Number.isFinite(n) ? Math.round(n * 2) / 2 : 0;
  const sizeClass = size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${sizeClass} ${className}`}
      role="img"
      aria-label={`${rounded} out of ${max} stars`}
    >
      {Array.from({ length: max }, (_, i) => {
        const threshold = i + 1;
        const filled = rounded >= threshold;
        const half = !filled && rounded >= threshold - 0.5;
        return (
          <span key={i} className="relative inline-block leading-none" aria-hidden>
            <span className="text-slate-300">★</span>
            {(filled || half) && (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden text-amber-400"
                style={{ width: half ? '50%' : '100%' }}
              >
                ★
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
