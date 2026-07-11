import React from 'react';
import { Link } from 'react-router-dom';
import { formatWhen } from '../../utils/datetime';
import { bookService, businessPage } from '../../utils/customerPaths';
import { lxPillTone } from '../../utils/pillGradients';

const MAX_VISIBLE_SERVICES = 2;

const statusLabel = {
  approved: 'Connected',
  pending: 'Pending approval',
};

export default function ScheduledProviderCard({
  provider,
  compact = false,
  toneIndex = 0,
  toneCount = 2,
}) {
  const {
    organization_slug: slug,
    organization_name: name,
    customer_status: customerStatus,
    next_booking: nextBooking,
    services = [],
    booking_count: bookingCount,
  } = provider;

  const status = statusLabel[customerStatus] || customerStatus;
  const visible = services.slice(0, MAX_VISIBLE_SERVICES);
  const remaining = services.length - visible.length;
  const tone = lxPillTone(toneIndex, toneCount);

  // No logos/avatars here — mixed provider photos break the home card aesthetic.
  // Profile imagery belongs on the dedicated provider pages.
  return (
    <article
      className={`flex h-full flex-col rounded-3xl p-4 shadow-lx-soft ring-1 transition duration-200 hover:-translate-y-0.5 hover:shadow-lx-elevated ${tone.surface} ${tone.ring}`}
    >
      <div className="min-w-0">
        <Link
          to={businessPage(slug)}
          className={`font-semibold tracking-tight transition ${tone.title} ${tone.link}`}
        >
          {name}
        </Link>
        <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 text-xs ${tone.meta}`}>
          {status && <span className="capitalize">{status}</span>}
          {bookingCount > 0 && (
            <span>
              · {bookingCount} booking{bookingCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {!compact && nextBooking && (
          <p className={`mt-1.5 text-sm ${tone.body}`}>
            Next: {nextBooking.service_name} · {formatWhen(nextBooking.start_at)}
          </p>
        )}
      </div>

      {!compact && visible.length > 0 && (
        <div className={`mt-3 border-t pt-2 ${tone.border}`}>
          <ul className="space-y-0.5">
            {visible.map((s) => (
              <li key={s.id}>
                <Link
                  to={bookService(slug, s.id)}
                  className={`flex min-h-[40px] items-center justify-between rounded-xl px-2 py-1.5 text-sm transition ${tone.hoverRow}`}
                >
                  <span className={`font-medium ${tone.title}`}>{s.name}</span>
                  <span className={`text-xs font-semibold ${tone.link}`}>Book →</span>
                </Link>
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <Link to={businessPage(slug)} className={`mt-1 block px-2 text-xs font-medium ${tone.link}`}>
              +{remaining} more service{remaining !== 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {!compact && services.length === 0 && (
        <Link to={businessPage(slug)} className={`mt-3 inline-block text-sm font-medium ${tone.link}`}>
          View provider →
        </Link>
      )}
    </article>
  );
}
