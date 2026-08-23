import React from 'react';
import {
  formatDurationTakesLabel,
  formatFulfillmentDescription,
  formatServicePrice,
  servicePriceIsForVisit,
} from '../../utils/serviceDisplay';

/**
 * Duration and price as separate facts so "$45" + "1 hour" is not read as an hourly rate.
 */
export default function ServiceVisitFacts({ service, forceShowPrice = false }) {
  const duration = formatDurationTakesLabel(service?.duration_minutes);
  const price = formatServicePrice(service, undefined, { forceShowPrice });
  const priceForVisit = servicePriceIsForVisit(service);
  const fulfillment = formatFulfillmentDescription(service);

  if (!duration && !price && !fulfillment) return null;

  return (
    <div className="mt-3 space-y-2">
      {(duration || price) && (
        <div className={`grid gap-2 ${duration && price ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {duration && (
            <div className="rounded-xl border border-teal-200/80 bg-teal-50/80 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800/70">
                Time needed
              </p>
              <p className="mt-0.5 text-sm font-semibold text-teal-950">{duration}</p>
            </div>
          )}
          {price && (
            <div className="rounded-xl border border-teal-200/80 bg-teal-50/80 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800/70">
                {priceForVisit ? 'Price for this visit' : 'Price'}
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-teal-950">{price}</p>
            </div>
          )}
        </div>
      )}
      {fulfillment && <p className="text-sm text-slate-600">{fulfillment}</p>}
    </div>
  );
}
