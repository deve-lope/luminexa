import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import BookingStatusTimeline from '../booking/BookingStatusTimeline';
import BookingRateModal from '../booking/BookingRateModal';
import AddToCalendarModal from '../booking/AddToCalendarModal';
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
import RequestMessageThread from '../provider/RequestMessageThread';
import { jobsAPI } from '../../utils/api';
import { formatJobLocationLabel, serviceRequiresQuote } from '../../utils/serviceDisplay';
import { formatServiceAddressDisplay } from './ServiceLocationInput';
import StarRating from '../services/StarRating';

function ReviewSnippet({ review }) {
  if (!review) return null;
  return (
    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/70">Your rating</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <StarRating value={review.average} />
        <span className="text-sm font-semibold text-amber-800">{review.average}</span>
      </div>
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
  /** List-row mode: service / when / status + link to full detail page. */
  compact = false,
  detailTo = null,
  onReschedule,
  onCancel,
  cancelling = false,
  onReviewSubmitted,
  onQuoteUpdated,
}) {
  const [rateOpen, setRateOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [answers, setAnswers] = useState(() =>
    (booking.quote_questions || []).map((q) => ({ id: q.id, answer: q.answer || '' }))
  );
  const past = isPastBooking(booking);
  const approved = wasApprovedByProvider(booking);
  const declined = wasDeclinedByProvider(booking);
  const providerKey = providerCustomerKey(booking);
  const canRate = Boolean(booking.can_rate);
  const myReview = booking.my_review;
  const isQuoted = booking.status === 'quoted';
  const awaitingTimeChange = Boolean(booking.awaiting_customer_acceptance);
  const needsQuote =
    booking.requires_quote ||
    booking.booking_policy === 'quote' ||
    serviceRequiresQuote(booking.service_pricing_type);

  let statusHint = null;
  if (awaitingTimeChange && isQuoted && !past) {
    statusHint =
      'The business proposed a new time and sent a quote. Review both below, then accept or decline.';
  } else if (awaitingTimeChange && needsQuote && !isQuoted && !past) {
    statusHint =
      'The business proposed a new time. They still need to send a quote before you can confirm.';
  } else if (awaitingTimeChange && !past) {
    statusHint = 'The business proposed a new appointment time. Accept to lock it in, or decline.';
  } else if (isQuoted && !past) {
    statusHint = 'Quote ready — review the price below, answer any questions, then accept or decline.';
  } else if (booking.status === 'requested' && needsQuote && !past) {
    statusHint = 'Your request is in. The business will send a quote — you can still change the time or cancel.';
  } else if (isUntouchedBookingRequest(booking) && !past) {
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

  const statusLabel = bookingStatusLabel(booking.status, {
    isPast: past,
    bookingPolicy: booking.booking_policy,
    servicePricingType: booking.service_pricing_type,
    awaitingCustomerAcceptance: awaitingTimeChange,
  });

  if (compact) {
    const needsAttention =
      (!past && (isQuoted || awaitingTimeChange)) ||
      (booking.status === 'completed' && canRate);
    const compactHint = needsAttention
      ? isQuoted && !past
        ? 'Quote ready — open for details'
        : awaitingTimeChange && !past
          ? 'Time change proposed — open for details'
          : canRate
            ? 'Ready to rate — open for details'
            : null
      : null;
    const body = (
      <>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold tracking-tight text-slate-900">{booking.service_name}</p>
            <p className="mt-0.5 truncate text-sm text-slate-600">{booking.organization_name}</p>
          </div>
          <span className={`shrink-0 ${bookingStatusClass(booking.status)}`}>
            {statusLabel}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium text-slate-500">When · </span>
          {formatWhen(booking.start_at)}
        </p>
        {(booking.job_location || booking.service_address) && (
          <p className="mt-1 line-clamp-1 text-sm text-slate-600">
            <span className="font-medium text-slate-500">Place · </span>
            {formatServiceAddressDisplay(booking.job_location || booking.service_address)}
          </p>
        )}
        {compactHint && <p className="mt-2 text-xs font-medium text-amber-800">{compactHint}</p>}
        {detailTo && (
          <p className="mt-3 text-sm font-medium text-teal-700">
            Full details →
          </p>
        )}
      </>
    );

    return (
      <li className="lx-card">
        {detailTo ? (
          <Link
            to={detailTo}
            className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
          >
            {body}
          </Link>
        ) : (
          body
        )}
      </li>
    );
  }

  const acceptTimeChange = async () => {
    setQuoteBusy(true);
    setQuoteError('');
    try {
      await jobsAPI.acceptBookingTimeChange(booking.id);
      onQuoteUpdated?.();
    } catch (e) {
      const d = e.response?.data;
      setQuoteError(d?.detail || d?.status?.[0] || 'Could not accept the new time.');
    } finally {
      setQuoteBusy(false);
    }
  };

  const declineTimeChange = async () => {
    setQuoteBusy(true);
    setQuoteError('');
    try {
      await jobsAPI.declineBookingTimeChange(booking.id);
      onQuoteUpdated?.();
    } catch (e) {
      const d = e.response?.data;
      setQuoteError(d?.detail || d?.status?.[0] || 'Could not decline the new time.');
    } finally {
      setQuoteBusy(false);
    }
  };

  const acceptQuote = async () => {
    setQuoteBusy(true);
    setQuoteError('');
    try {
      await jobsAPI.acceptBookingQuote(booking.id, { answers });
      onQuoteUpdated?.();
    } catch (e) {
      const d = e.response?.data;
      setQuoteError(d?.detail || d?.status?.[0] || 'Could not accept quote.');
    } finally {
      setQuoteBusy(false);
    }
  };

  const declineQuote = async () => {
    setQuoteBusy(true);
    setQuoteError('');
    try {
      await jobsAPI.declineBooking(booking.id);
      onQuoteUpdated?.();
    } catch (e) {
      const d = e.response?.data;
      setQuoteError(d?.detail || 'Could not decline quote.');
    } finally {
      setQuoteBusy(false);
    }
  };

  return (
    <li className="lx-card">
      <p className="font-semibold tracking-tight text-slate-900">{booking.service_name}</p>
      {providerKey ? (
        <Link
          to={customerProviderPage(providerKey)}
          className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline"
        >
          {booking.organization_name}
        </Link>
      ) : (
        <p className="text-sm text-slate-600">{booking.organization_name}</p>
      )}

      <div className="mt-2 space-y-1.5 text-sm text-slate-700">
        <p>
          <span className="font-medium text-slate-500">When · </span>
          {formatWhen(booking.start_at)}
        </p>
        {(booking.job_location || booking.service_address) && (
          <p>
            <span className="font-medium text-slate-500">
              {formatJobLocationLabel(booking).replace(/^Job location — /i, '')} ·{' '}
            </span>
            <span className="whitespace-pre-wrap">
              {formatServiceAddressDisplay(booking.job_location || booking.service_address)}
            </span>
          </p>
        )}
      </div>
      <span className={`mt-2 ${bookingStatusClass(booking.status)}`}>
        {statusLabel}
      </span>
      {statusHint && <p className="mt-2 text-xs text-slate-500">{statusHint}</p>}

      {awaitingTimeChange && booking.prior_start_at && !past && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/80">
            Time change proposed
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="text-slate-500 line-through">{formatWhen(booking.prior_start_at)}</span>
            <span className="mx-2 text-slate-400">→</span>
            <span className="font-semibold text-slate-900">{formatWhen(booking.start_at)}</span>
          </p>
          {awaitingTimeChange && !needsQuote && (
            <>
              {quoteError && <p className="mt-2 text-sm text-red-700">{quoteError}</p>}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={quoteBusy}
                  onClick={acceptTimeChange}
                  className="min-h-[44px] flex-1 rounded-xl bg-luminexa-accent text-sm font-semibold text-white disabled:opacity-60"
                >
                  {quoteBusy ? 'Saving…' : 'Accept new time'}
                </button>
                <button
                  type="button"
                  disabled={quoteBusy}
                  onClick={declineTimeChange}
                  className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                  Decline change
                </button>
              </div>
            </>
          )}
          {awaitingTimeChange && needsQuote && !isQuoted && (
            <p className="mt-2 text-xs text-amber-900">
              Waiting for the business to send a quote for this new time.
            </p>
          )}
        </div>
      )}

      {booking.status === 'requested' &&
        (booking.quote_questions || []).some((q) => (q.answer || '').trim()) && (
        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your answers</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {booking.quote_questions.map((q) => (
              <li key={q.id}>
                <span className="font-medium">{q.question}</span>
                {q.answer ? <span className="text-slate-600"> — {q.answer}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isQuoted && booking.quote_amount != null && (
        <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800/80">Quote</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            ${Number(booking.quote_amount).toFixed(2)}
          </p>
          {booking.quote_message ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{booking.quote_message}</p>
          ) : null}
          {(booking.quote_questions || []).length > 0 && (
            <div className="mt-3 space-y-2">
              {booking.quote_questions.map((q, idx) => (
                <div key={q.id || idx}>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{q.question}</label>
                  <input
                    value={answers.find((a) => a.id === q.id)?.answer || ''}
                    onChange={(e) => {
                      setAnswers((prev) => {
                        const next = [...prev];
                        const i = next.findIndex((a) => a.id === q.id);
                        if (i >= 0) next[i] = { ...next[i], answer: e.target.value };
                        else next.push({ id: q.id, answer: e.target.value });
                        return next;
                      });
                    }}
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    placeholder="Your answer"
                  />
                </div>
              ))}
            </div>
          )}
          {quoteError && <p className="mt-2 text-sm text-red-700">{quoteError}</p>}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={quoteBusy}
              onClick={acceptQuote}
              className="min-h-[44px] flex-1 rounded-xl bg-luminexa-accent text-sm font-semibold text-white disabled:opacity-60"
            >
              {quoteBusy
                ? 'Saving…'
                : awaitingTimeChange
                  ? 'Accept quote & new time'
                  : 'Accept quote'}
            </button>
            <button
              type="button"
              disabled={quoteBusy}
              onClick={declineQuote}
              className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        </div>
      )}

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
            showBreakdown
            allowPayOnline
          />
        </div>
      )}

      <RequestMessageThread
        compact
        peerName={booking.organization_name}
        emptyHint="Message the business about this booking."
        idleOpenLabel="Message business"
        loadMessages={() => jobsAPI.listBookingMessages(booking.id)}
        sendMessage={(body) => jobsAPI.sendBookingMessage(booking.id, body)}
      />

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
        <div className="mt-4 space-y-2 border-t border-slate-100/80 pt-4">
          <div className="grid grid-cols-2 gap-2">
            {detailTo && (
              <Link to={detailTo} className="lx-btn-ghost w-full px-3 text-center">
                Full details
              </Link>
            )}
            {providerKey && (
              <Link
                to={customerProviderPage(providerKey)}
                className="lx-btn-ghost w-full px-3 text-center"
              >
                View provider
              </Link>
            )}
            {providerKey && booking.service && (
              <Link
                to={customerProviderServiceDetail(providerKey, booking.service)}
                className="lx-btn-ghost w-full px-3 text-center"
              >
                Service details
              </Link>
            )}
            {booking.status === 'confirmed' && (
              <button
                type="button"
                onClick={() => setCalendarOpen(true)}
                className="lx-btn-ghost inline-flex w-full items-center justify-center gap-1.5 px-3 text-center"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Add to calendar
              </button>
            )}
          </div>
          {(onReschedule || onCancel) && (
            <div className={`grid gap-2 ${onReschedule && onCancel ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {onReschedule && (
                <button
                  type="button"
                  onClick={() => onReschedule(booking)}
                  className="lx-btn-secondary w-full px-3"
                >
                  Reschedule
                </button>
              )}
              {onCancel && (
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => onCancel(booking.id)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                >
                  {cancelling ? 'Cancelling…' : 'Cancel'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <BookingRateModal
        open={rateOpen}
        booking={booking}
        onClose={() => setRateOpen(false)}
        onSubmitted={() => onReviewSubmitted?.()}
      />
      <AddToCalendarModal
        open={calendarOpen}
        booking={booking}
        onClose={() => setCalendarOpen(false)}
      />
    </li>
  );
}
