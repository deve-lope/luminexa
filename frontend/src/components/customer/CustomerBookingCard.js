import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import BookingStatusTimeline from '../booking/BookingStatusTimeline';
import BookingRateModal from '../booking/BookingRateModal';
import InvoicePanel from '../booking/InvoicePanel';
import { formatWhen } from '../../utils/datetime';
import {
  bookingStatusClass,
  bookingStatusLabel,
  isPastBooking,
  isUntouchedBookingRequest,
  wasApprovedByProvider,
  wasDeclinedByProvider,
} from '../../utils/customerBookings';
import {
  customerProviderPage,
  customerProviderServiceDetail,
} from '../../utils/customerPaths';
import { providerCustomerKey } from '../../utils/providerRouteKey';
import { jobsAPI } from '../../utils/api';
import { formatJobLocationLabel } from '../../utils/serviceDisplay';
import { formatServiceAddressDisplay } from './ServiceLocationInput';

function ReviewSnippet({ review }) {
  if (!review) return null;
  return (
    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/70">Your rating</p>
      <p className="mt-1 text-sm font-semibold text-amber-600">★ {review.average}</p>
      {review.comment ? (
        <p className="mt-1 text-sm text-slate-700 line-clamp-3">{review.comment}</p>
      ) : (
        <p className="mt-1 text-xs italic text-slate-500">No written comment.</p>
      )}
    </div>
  );
}

export default function CustomerBookingCard({
  booking,
  expanded,
  onToggleExpand,
  showActions = false,
  onReschedule,
  onCancel,
  cancelling = false,
  onReviewSubmitted,
}) {
  const [rateOpen, setRateOpen] = useState(false);
  const past = isPastBooking(booking);
  const approved = wasApprovedByProvider(booking);
  const declined = wasDeclinedByProvider(booking);
  const providerKey = providerCustomerKey(booking);
  const canRate = Boolean(booking.can_rate);
  const myReview = booking.my_review;

  let statusHint = null;
  if (isUntouchedBookingRequest(booking) && !past) {
    statusHint =
      'Waiting for the business to respond. You can reschedule to another day or time, or cancel.';
  } else if (booking.status === 'requested' && past) {
    statusHint = 'This request was not confirmed before the appointment time.';
  } else if (approved && booking.status === 'confirmed' && !past) {
    statusHint = 'Approved by the business. You can request a new time if needed.';
  } else if (approved && booking.status === 'confirmed') {
    statusHint = 'Approved by the business.';
  } else if (declined) {
    statusHint = 'Declined by the business.';
  } else if (booking.status === 'completed') {
    statusHint = canRate
      ? 'Service completed — leave a rating when you are ready.'
      : 'Service completed.';
  }

  return (
    <li className="lx-card">
      <p className="font-semibold tracking-tight text-slate-900">{booking.service_name}</p>
      <p className="text-sm text-slate-600">{booking.organization_name}</p>
      <p className="mt-1 text-sm text-slate-500">{formatWhen(booking.start_at)}</p>
      {(booking.job_location || booking.service_address) && (
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {formatJobLocationLabel(booking)}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">
            {formatServiceAddressDisplay(booking.job_location || booking.service_address)}
          </p>
        </div>
      )}
      <span
        className={`mt-2 inline-block capitalize ${bookingStatusClass(booking.status)}`}
      >
        {bookingStatusLabel(booking.status, { isPast: past })}
      </span>
      {statusHint && <p className="mt-2 text-xs text-slate-500">{statusHint}</p>}

      {booking.status === 'completed' && canRate && (
        <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-3">
          <p className="text-sm font-semibold text-violet-900">How was this service?</p>
          <p className="mt-0.5 text-xs text-violet-800/80">
            Rate communication, price, punctuality, and quality — and leave a short review.
          </p>
          <button
            type="button"
            onClick={() => setRateOpen(true)}
            className="mt-3 min-h-[44px] w-full rounded-xl bg-violet-700 text-sm font-semibold text-white"
          >
            Rate & review
          </button>
        </div>
      )}

      {booking.status === 'completed' && myReview && !canRate && (
        <ReviewSnippet review={myReview} />
      )}

      {booking.status === 'completed' && booking.invoice && (
        <div className="mt-3">
          <InvoicePanel
            invoice={booking.invoice}
            bookingId={booking.id}
            providerName={
              booking.invoice.provider_name || booking.organization_name
            }
            compact
          />
        </div>
      )}
      {booking.status_events?.length > 0 && (
        <div className="mt-4 border-t border-slate-100/80 pt-4">
          <button
            type="button"
            onClick={() => onToggleExpand?.(booking.id)}
            className="lx-link"
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
          {providerKey && (
            <Link
              to={customerProviderPage(providerKey)}
              className="lx-btn-ghost"
            >
              View provider
            </Link>
          )}
          {providerKey && booking.service && (
            <Link
              to={customerProviderServiceDetail(providerKey, booking.service)}
              className="lx-btn-ghost"
            >
              Service details
            </Link>
          )}
          {booking.status === 'confirmed' && (
            <a
              href={jobsAPI.bookingIcalUrl(booking.id)}
              download
              className="lx-btn-ghost gap-1.5"
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
              className="lx-btn-secondary"
            >
              Reschedule
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => onCancel(booking.id)}
              className="min-h-[44px] rounded-xl border border-red-200/80 bg-red-50/80 px-4 text-sm font-medium text-red-700 transition hover:bg-red-100/80 disabled:opacity-60"
            >
              {cancelling ? 'Cancelling…' : 'Cancel booking'}
            </button>
          )}
        </div>
      )}

      <BookingRateModal
        open={rateOpen}
        booking={booking}
        onClose={() => setRateOpen(false)}
        onSubmitted={() => onReviewSubmitted?.()}
      />
    </li>
  );
}
