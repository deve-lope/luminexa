import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ServiceAvailabilityPreview from '../../components/booking/ServiceAvailabilityPreview';
import RequestMessageThread from '../../components/provider/RequestMessageThread';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { formatWhen } from '../../utils/datetime';
import { customerBookings, customerBookingDetail, customerHistory, customerProviderPage } from '../../utils/customerPaths';
import { providerCustomerKey } from '../../utils/providerRouteKey';

function statusLabel(status) {
  const labels = {
    pending: 'Awaiting business',
    active: 'In progress',
    quoted: 'Quote ready',
    quote_accepted: 'Pick a time',
    completed: 'Booked',
    declined: 'Declined',
  };
  return labels[status] || status;
}

export default function CustomerInquiryDetailPage() {
  const { inquiryId } = useParams();
  const navigate = useNavigate();
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);

  const load = useCallback(() => {
    if (!inquiryId) return;
    setLoading(true);
    setError(null);
    jobsAPI
      .getMyServiceInquiry(inquiryId)
      .then((res) => setInquiry(res.data))
      .catch((err) => {
        setInquiry(null);
        setError(parseApiError(err, 'Could not load this request.'));
      })
      .finally(() => setLoading(false));
  }, [inquiryId]);

  useEffect(() => {
    load();
  }, [load]);

  const orgKey =
    inquiry?.organization_slug ||
    inquiry?.organization_public_ref ||
    providerCustomerKey(inquiry);

  const acceptQuote = async () => {
    setBusy(true);
    setActionError('');
    try {
      const res = await jobsAPI.acceptInquiryQuote(inquiryId);
      setInquiry(res.data);
    } catch (err) {
      setActionError(parseApiError(err, 'Could not accept quote.'));
    } finally {
      setBusy(false);
    }
  };

  const declineQuote = async () => {
    setBusy(true);
    setActionError('');
    try {
      const res = await jobsAPI.declineInquiryQuote(inquiryId);
      setInquiry(res.data);
    } catch (err) {
      setActionError(parseApiError(err, 'Could not decline quote.'));
    } finally {
      setBusy(false);
    }
  };

  const bookSlot = async () => {
    if (!selectedSlot?.id) {
      setActionError('Choose an open time first.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      const res = await jobsAPI.bookInquirySlot(inquiryId, selectedSlot.id);
      const bookingId = res.data?.booking?.id;
      if (bookingId) {
        navigate(customerBookingDetail(bookingId));
        return;
      }
      setInquiry(res.data?.inquiry || res.data);
    } catch (err) {
      setActionError(parseApiError(err, 'Could not book this time.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !inquiry) {
    return <p className="py-8 text-center text-slate-500">Loading…</p>;
  }

  if (error && !inquiry) {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-red-600">{error}</p>
        <Link to={customerHistory()} className="lx-link inline-block">
          ← History
        </Link>
      </div>
    );
  }

  const isQuoted = inquiry.status === 'quoted';
  const quoteAccepted = inquiry.status === 'quote_accepted';
  const canBook = quoteAccepted && inquiry.service && !inquiry.booking;

  return (
    <div className="space-y-4">
      <Link to={customerBookings()} className="lx-link inline-flex min-h-[40px] items-center">
        ← Bookings
      </Link>

      <div className="lx-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {inquiry.service_name || inquiry.service_label || 'Quote request'}
            </h1>
            {orgKey && (
              <Link
                to={customerProviderPage(orgKey)}
                className="text-sm font-medium text-teal-700 hover:underline"
              >
                {inquiry.organization_name}
              </Link>
            )}
          </div>
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-900">
            {statusLabel(inquiry.status)}
          </span>
        </div>
        <p className="text-sm text-slate-500">Submitted {formatWhen(inquiry.created_at)}</p>
        {inquiry.preferred_date && (
          <p className="text-sm text-slate-600">
            Preferred date (hint): {inquiry.preferred_date}
          </p>
        )}
        {inquiry.service_address && (
          <p className="whitespace-pre-wrap text-sm text-slate-700">{inquiry.service_address}</p>
        )}
        <p className="whitespace-pre-wrap text-sm text-slate-800">{inquiry.message}</p>
      </div>

      {isQuoted && inquiry.quote_amount != null && (
        <div className="lx-card border-violet-100 bg-violet-50/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Quote</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            ${Number(inquiry.quote_amount).toFixed(2)}
          </p>
          {inquiry.quote_message && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{inquiry.quote_message}</p>
          )}
          {actionError && <p className="mt-2 text-sm text-red-700">{actionError}</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={acceptQuote}
              className="lx-btn-primary min-h-[48px] flex-1 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Accept quote & pick a time'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={declineQuote}
              className="min-h-[48px] flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {quoteAccepted && inquiry.quote_amount != null && (
        <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-950">
          Quote accepted (${Number(inquiry.quote_amount).toFixed(2)}). Choose an open time below
          to confirm your appointment.
        </div>
      )}

      {(inquiry.status === 'pending' ||
        inquiry.status === 'active' ||
        isQuoted ||
        canBook) &&
        inquiry.service && (
          <ServiceAvailabilityPreview
            orgSlug={orgKey}
            serviceId={inquiry.service}
            title={canBook ? 'Choose your appointment' : 'When they’re available'}
            hint={
              canBook
                ? 'Pick a time to confirm your booking.'
                : isQuoted
                  ? 'Accept the quote above, then pick one of these open times.'
                  : 'These are open slots while you wait for a quote — nothing is held yet.'
            }
            selectable={canBook}
            selectedSlotId={selectedSlot?.id}
            onSelectSlot={setSelectedSlot}
          />
        )}

      {canBook && (
        <>
          {actionError && <p className="text-sm text-red-700">{actionError}</p>}
          <button
            type="button"
            disabled={busy || !selectedSlot}
            onClick={bookSlot}
            className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
          >
            {busy ? 'Booking…' : 'Confirm appointment'}
          </button>
        </>
      )}

      {inquiry.booking && (
        <Link
          to={customerBookingDetail(inquiry.booking)}
          className="lx-btn-primary inline-flex min-h-[48px] w-full items-center justify-center"
        >
          View confirmed booking
        </Link>
      )}

      {orgKey && (
        <RequestMessageThread
          compact
          peerName={inquiry.organization_name}
          emptyHint="Message the business about this quote request."
          idleOpenLabel="Message business"
          loadMessages={() => jobsAPI.listInquiryMessages(orgKey, inquiry.id)}
          sendMessage={(body) => jobsAPI.sendInquiryMessage(orgKey, inquiry.id, { body })}
        />
      )}
    </div>
  );
}