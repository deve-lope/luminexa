import React from 'react';
import {
  formatDurationLabel,
  formatFulfillmentDescription,
  formatServicePrice,
  servicePriceIsForVisit,
} from '../../utils/serviceDisplay';

/**
 * Compact duration + price meta. Keeps visit price distinct from an hourly rate
 * without the heavy two-card layout that crowds mobile booking.
 */
export default function ServiceVisitFacts({ service, forceShowPrice = false }) {
  const duration = formatDurationLabel(service?.duration_minutes);
  const price = formatServicePrice(service, undefined, { forceShowPrice });
  const priceForVisit = servicePriceIsForVisit(service);
  const fulfillment = formatFulfillmentDescription(service);

  if (!duration && !price && !fulfillment) return null;

  return (
    <div className="mt-2 space-y-1">
      {(duration || price) && (
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm leading-snug text-slate-600">
          {duration && <span className="font-medium text-slate-800">{duration}</span>}
          {duration && price ? (
            <span className="select-none text-slate-300" aria-hidden>
              ·
            </span>
          ) : null}
          {price && (
            <span>
              <span className="font-semibold tabular-nums text-slate-900">{price}</span>
              {priceForVisit ? (
                <span className="ml-1 text-slate-500">for visit</span>
              ) : null}
            </span>
          )}
        </p>
      )}
      {fulfillment && <p className="text-xs leading-snug text-slate-500">{fulfillment}</p>}
    </div>
  );
}
