import React from 'react';
import { Link } from 'react-router-dom';
import { formatWhen } from '../../utils/datetime';
import { bookService, businessPage } from '../../utils/customerPaths';

const MAX_VISIBLE_SERVICES = 2;

const statusLabel = {
  approved: 'Connected',
  pending: 'Pending approval',
};

export default function ScheduledProviderCard({ provider, compact = false }) {
  const {
    organization_slug: slug,
    organization_name: name,
    logo_url: logoUrl,
    customer_status: customerStatus,
    next_booking: nextBooking,
    services = [],
    booking_count: bookingCount,
  } = provider;

  const status = statusLabel[customerStatus] || customerStatus;
  const visible = services.slice(0, MAX_VISIBLE_SERVICES);
  const remaining = services.length - visible.length;

  return (
    <article className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base font-semibold text-slate-500">
            {name?.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Link to={businessPage(slug)} className="font-semibold text-slate-900 hover:text-luminexa-accent">
            {name}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            {status && <span className="capitalize">{status}</span>}
            {bookingCount > 0 && (
              <span>· {bookingCount} booking{bookingCount !== 1 ? 's' : ''}</span>
            )}
          </div>
          {!compact && nextBooking && (
            <p className="mt-1.5 text-sm text-slate-600">
              Next: {nextBooking.service_name} · {formatWhen(nextBooking.start_at)}
            </p>
          )}
        </div>
      </div>

      {!compact && visible.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <ul className="space-y-0.5">
            {visible.map((s) => (
              <li key={s.id}>
                <Link
                  to={bookService(slug, s.id)}
                  className="flex min-h-[40px] items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">{s.name}</span>
                  <span className="text-xs text-luminexa-accent">Book →</span>
                </Link>
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <Link
              to={businessPage(slug)}
              className="mt-1 block px-2 text-xs font-medium text-slate-500 hover:text-luminexa-accent"
            >
              +{remaining} more service{remaining !== 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {!compact && services.length === 0 && (
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
