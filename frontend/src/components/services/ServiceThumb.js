import React from 'react';
import BusinessTypeIcon from '../icons/BusinessTypeIcon';
import { serviceThumbnailUrl } from '../../utils/serviceDisplay';

/**
 * Service photo when one exists (cover or gallery). Otherwise the category
 * two-color mark — never the old van/shop emoji.
 */
export default function ServiceThumb({
  service,
  slug,
  className = 'h-11 w-11',
  iconClassName = 'h-5 w-5',
  muted = false,
}) {
  const src = serviceThumbnailUrl(service);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`shrink-0 rounded-xl object-cover ring-1 ${
          muted ? 'ring-slate-200 opacity-80' : 'ring-teal-200/80'
        } ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl shadow-sm ${
        muted
          ? 'bg-slate-200 text-slate-500'
          : 'bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-800 ring-1 ring-teal-100/80'
      } ${className}`}
      aria-hidden
    >
      <BusinessTypeIcon
        slug={slug}
        name={service?.category_name}
        className={iconClassName}
      />
    </div>
  );
}
