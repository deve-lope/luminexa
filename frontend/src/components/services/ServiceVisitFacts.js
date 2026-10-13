import React from 'react';
import { IconSchedule, IconShop, IconTruck } from '../icons/NavIcons';
import {
  formatDurationLabel,
  formatFulfillmentDescription,
  formatFulfillmentLabel,
  formatServicePrice,
  isShopService,
  servicePriceIsForVisit,
} from '../../utils/serviceDisplay';

function IconTag({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function Fact({ icon, label, value, hint, tone = 'teal' }) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700 ring-teal-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  };
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3.5 sm:flex-col sm:items-start sm:gap-2 sm:px-5 sm:py-4">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-0.5 text-lg font-bold leading-tight tracking-tight tabular-nums text-slate-900">
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs leading-snug text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Duration + price + where it happens.
 * - default: compact text line (booking flow keeps the screen short on mobile)
 * - variant="card": icon tiles for the service detail page
 */
export default function ServiceVisitFacts({ service, forceShowPrice = false, variant = 'compact' }) {
  const duration = formatDurationLabel(service?.duration_minutes);
  const price = formatServicePrice(service, undefined, { forceShowPrice });
  const priceForVisit = servicePriceIsForVisit(service);
  const fulfillment = formatFulfillmentDescription(service);

  if (!duration && !price && !fulfillment) return null;

  if (variant === 'card') {
    const shop = isShopService(service);
    const facts = [];
    if (price) {
      facts.push(
        <Fact
          key="price"
          icon={<IconTag />}
          label="Price"
          value={price}
          hint={priceForVisit ? 'for the whole visit' : null}
        />
      );
    }
    if (duration) {
      facts.push(
        <Fact
          key="time"
          icon={<IconSchedule className="h-5 w-5" />}
          label="Time needed"
          value={duration}
          tone="amber"
        />
      );
    }
    if (fulfillment) {
      facts.push(
        <Fact
          key="where"
          icon={shop ? <IconShop className="h-5 w-5" /> : <IconTruck className="h-5 w-5" />}
          label="Where"
          value={formatFulfillmentLabel(service)}
          hint={shop ? 'You go to the business' : 'They come to you'}
          tone="violet"
        />
      );
    }
    const cols = facts.length >= 3 ? 'sm:grid-cols-3' : facts.length === 2 ? 'sm:grid-cols-2' : '';
    return (
      <div
        className={`grid grid-cols-1 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-luminexa-line bg-white shadow-lx-card sm:divide-x sm:divide-y-0 ${cols}`}
      >
        {facts}
      </div>
    );
  }

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
