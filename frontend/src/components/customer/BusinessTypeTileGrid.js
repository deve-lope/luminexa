import React, { useMemo } from 'react';
import BusinessTypeTile from './BusinessTypeTile';

/**
 * Cap at 4 columns. For 1–3 tiles, center a tighter grid so leftover
 * space is even on both sides. For 4+, fill the section width.
 */
function gridClass(count) {
  if (count <= 1) return 'mx-auto grid max-w-xs grid-cols-1 gap-3 sm:gap-4';
  if (count === 2) return 'mx-auto grid w-full max-w-2xl grid-cols-2 gap-3 sm:gap-4';
  if (count === 3) {
    return 'mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3';
  }
  return 'grid w-full grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4';
}

export default function BusinessTypeTileGrid({ types, getLinkTo }) {
  const active = useMemo(
    () => types.filter((t) => (t.provider_count ?? 0) > 0),
    [types],
  );
  if (!active.length) return null;

  return (
    <div className={gridClass(active.length)}>
      {active.map((type, i) => (
        <BusinessTypeTile
          key={type.slug}
          type={type}
          linkTo={getLinkTo}
          toneIndex={i}
          toneCount={active.length}
        />
      ))}
    </div>
  );
}
