import React from 'react';
import { Link } from 'react-router-dom';
import { formatWhen } from '../../utils/datetime';
import { bookService, businessPage } from '../../utils/customerPaths';

const statusLabel = {
  approved: 'Connected',
  pending: 'Pending approval',
};

export default function ScheduledProviderCard({ provider }) {
  const {
    organization_slug: slug,
    organization_name: name,
    logo_url: logoUrl,
    customer_status: customerStatus,
    next_booking: nextBooking,
    services = [],
  } = provider;

  const status = statusLabel[customerStatus] || customerStatus;

  return (
    <article className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg font-semibold text-slate-500">
            {name?.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Link to={businessPage(slug)} className="font-semibold text-slate-900">
            {name}
          </Link>
          {status && (
            <p className="mt-0.5 text-xs text-slate-500 capitalize">{status}</p>
          )}
          {nextBooking && (
            <p className="mt-2 text-sm text-slate-600">
              Next: {nextBooking.service_name} · {formatWhen(nextBooking.start_at)}
            </p>
          )}
        </div>
      </div>
      {services.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {services.slice(0, 4).map((s) => (
            <li key={s.id}>
              <Link
                to={bookService(slug, s.id)}
                className="flex min-h-[44px] items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-800">{s.name}</span>
                <span className="text-luminexa-accent">Book →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {services.length === 0 && (
        <Link
          to={businessPage(slug)}
          className="mt-3 inline-block text-sm font-medium text-luminexa-accent"
        >
          View provider →
        </Link>
      )}
    </article>
  );
}
