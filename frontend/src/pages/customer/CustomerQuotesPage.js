import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../../components/ConfirmDialog';
import CustomerBookingCard from '../../components/customer/CustomerBookingCard';
import BookingsSubNav from '../../components/customer/BookingsSubNav';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { jobsAPI } from '../../utils/api';
import { isActiveInquiry, isPendingQuoteBooking } from '../../utils/customerBookings';
import { customerBookingDetail, customerFind, customerInquiryDetail } from '../../utils/customerPaths';
import { formatWhen } from '../../utils/datetime';

function inquiryNeedsAttention(inq) {
  return inq.status === 'quoted' || inq.status === 'quote_accepted';
}

export default function CustomerQuotesPage() {
  const [bookings, setBookings] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([jobsAPI.listBookings(), jobsAPI.listMyServiceInquiries()])
      .then(([bookingsRes, inquiriesRes]) => {
        setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : bookingsRes.data?.results || []);
        setInquiries(Array.isArray(inquiriesRes.data) ? inquiriesRes.data : []);
        setError(null);
      })
      .catch(() => setError('Could not load quote requests'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingBookings = useMemo(
    () => bookings.filter(isPendingQuoteBooking),
    [bookings]
  );
  const activeInquiries = useMemo(
    () => inquiries.filter(isActiveInquiry),
    [inquiries]
  );
  const hasItems = pendingBookings.length > 0 || activeInquiries.length > 0;

  const cancelInquiry = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      if (cancelTarget.status === 'pending' || cancelTarget.status === 'active') {
        await jobsAPI.cancelInquiryRequest(cancelTarget.id);
      } else {
        await jobsAPI.declineInquiryQuote(cancelTarget.id);
      }
      setCancelTarget(null);
      load();
    } catch {
      setError('Could not cancel that quote request.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      <BookingsSubNav />
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading quote requests">
          <Skeleton className="h-24 rounded-3xl" />
          <SkeletonList count={2} />
        </div>
      ) : !hasItems ? (
        <div className="lx-empty">
          <p className="text-slate-600">No open quotes or pending requests.</p>
          <p className="mt-1 text-sm text-slate-500">
            Quote requests and bookings waiting on a price or approval show up here until both
            sides confirm.
          </p>
          <Link
            to={customerFind()}
            className="lx-btn-primary mt-4 inline-flex min-h-[48px] items-center px-6"
          >
            Find a service
          </Link>
        </div>
      ) : (
        <>
          {activeInquiries.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Quote requests</h2>
              <ul className="space-y-3">
                {activeInquiries.map((inq) => (
                  <li key={inq.id} className="lx-card">
                    <p className="font-semibold text-slate-900">
                      {inq.service_name || inq.service_label || 'Quote request'}
                    </p>
                    <p className="text-sm text-slate-600">{inq.organization_name}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatWhen(inq.created_at)}</p>
                    {inq.status === 'quoted' && inq.quote_amount != null && (
                      <p className="mt-2 text-lg font-bold text-violet-900">
                        ${Number(inq.quote_amount).toFixed(2)}
                      </p>
                    )}
                    <p className="mt-2 text-sm text-slate-600">
                      {inq.status === 'quoted'
                        ? 'Quote ready — accept and pick a time.'
                        : inq.status === 'quote_accepted'
                          ? 'Quote accepted — choose an appointment time.'
                          : 'Waiting for the business to send a quote.'}
                    </p>
                    <Link
                      to={customerInquiryDetail(inq.id)}
                      className={`mt-4 inline-flex min-h-[44px] items-center text-sm font-semibold ${
                        inquiryNeedsAttention(inq) ? 'text-luminexa-accent' : 'text-slate-700'
                      }`}
                    >
                      {inq.status === 'quoted'
                        ? 'Review quote →'
                        : inq.status === 'quote_accepted'
                          ? 'Pick a time →'
                          : 'View request →'}
                    </Link>
                    {(inq.status === 'pending' ||
                      inq.status === 'active' ||
                      inq.status === 'quote_accepted') && (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(inq)}
                        className="mt-2 block text-sm font-medium text-red-600 hover:underline"
                      >
                        Cancel request
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pendingBookings.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
                Bookings awaiting confirmation
              </h2>
              <ul className="space-y-3">
                {pendingBookings.map((booking) => (
                  <CustomerBookingCard
                    key={booking.id}
                    booking={booking}
                    compact
                    detailTo={customerBookingDetail(booking.id)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel quote request?"
        message="The business will no longer see this as an open request."
        confirmLabel="Yes, cancel"
        cancelLabel="Keep request"
        tone="danger"
        busy={cancelling}
        onConfirm={cancelInquiry}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}
