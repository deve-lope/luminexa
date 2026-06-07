import React from 'react';
import BusinessTypeTile from './BusinessTypeTile';

export default function BusinessTypeTileGrid({ types, getLinkTo }) {
  if (!types.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {types.map((type) => (
        <BusinessTypeTile key={type.slug} type={type} linkTo={getLinkTo} />
      ))}
    </div>
  );
}
