import React from 'react';
import { Link } from 'react-router-dom';
import BookingStatusTimeline from '../booking/BookingStatusTimeline';
import { formatWhen } from '../../utils/datetime';
import {
  bookingStatusClass,
  bookingStatusLabel,
  isPastBooking,
  wasApprovedByProvider,
  wasDeclinedByProvider,
} from '../../utils/customerBookings';
import { customerProviderPage } from '../../utils/customerPaths';
import { providerCustomerKey } from '../../utils/providerRouteKey';
import { jobsAPI } from '../../utils/api';

export default function CustomerBookingCard({
  booking,
  expanded,
  onToggleExpand,
  showActions = false,
  onReschedule,
  onCancel,
  cancelling = false,
}) {
  const past = isPastBooking(booking);
  const approved = wasApprovedByProvider(booking);
  const declined = wasDeclinedByProvider(booking);

  let statusHint = null;
  if (booking.status === 'requested' && !past) {
    statusHint = 'Waiting for the business to approve your booking.';
  } else if (booking.status === 'requested' && past) {
    statusHint = 'This request was not confirmed before the appointment time.';
  } else if (approved && booking.status === 'confirmed') {
    statusHint = 'Approved by the business.';
  } else if (declined) {
    statusHint = 'Declined by the business.';
  } else if (booking.status === 'completed') {
    statusHint = 'Service completed.';
  }

  return (
    <li className="rounded-xl bg-white p-4 shadow-sm">
      <p className="font-semibold text-slate-900">{booking.service_name}</p>
      <p className="text-sm text-slate-600">{booking.organization_name}</p>
      <p className="mt-1 text-sm text-slate-500">{formatWhen(booking.start_at)}</p>
      <span
        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs capitalize ${bookingStatusClass(booking.status)}`}
      >
        {bookingStatusLabel(booking.status, { isPast: past })}
      </span>
      {statusHint && <p className="mt-2 text-xs text-slate-500">{statusHint}</p>}
      {booking.status_events?.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => onToggleExpand?.(booking.id)}
            className="text-sm font-medium text-luminexa-accent"
          >
            {expanded ? 'Hide activity' : 'View activity'}
          </button>
          {expanded && (
            <div className="mt-3">
              <BookingStatusTimeline events={booking.status_events} />
            </div>
          )}
        </div>
      )}
      {showActions && (
        <div className="mt-4 flex flex-wrap gap-2">
          {providerCustomerKey(booking) && (
            <Link
              to={customerProviderPage(providerCustomerKey(booking))}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-800"
            >
              View provider
            </Link>
          )}
          {booking.status === 'confirmed' && (
            <a
              href={jobsAPI.bookingIcalUrl(booking.id)}
              download
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Add to calendar
            </a>
          )}
          {onReschedule && (
            <button
              type="button"
              onClick={() => onReschedule(booking)}
              className="min-h-[44px] rounded-lg border border-violet-200 px-4 text-sm font-medium text-violet-800"
            >
              Reschedule
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => onCancel(booking.id)}
              className="min-h-[44px] rounded-lg border border-red-200 px-4 text-sm font-medium text-red-700 disabled:opacity-60"
            >
              {cancelling ? 'Cancelling…' : 'Cancel booking'}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
