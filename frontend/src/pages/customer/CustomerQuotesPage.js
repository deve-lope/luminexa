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
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

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

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      if (removeTarget.type === 'inquiry') {
        await jobsAPI.removeInquiry(removeTarget.item.id);
      } else {
        await jobsAPI.cancelBooking(removeTarget.item.id);
      }
      setRemoveTarget(null);
      load();
    } catch {
      setError(
        removeTarget.type === 'inquiry'
          ? 'Could not remove that quote request.'
          : 'Could not remove that booking request.',
      );
    } finally {
      setRemoving(false);
    }
  };

  const removeDialogMessage =
    removeTarget?.type === 'booking'
      ? 'This booking request will be cancelled and removed from your quotes.'
      : 'This quote request will be removed. The business will no longer see it as open.';

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
          <p className="text-sm text-slate-600">
            Bookings waiting on a price, your approval, or the business to respond.
          </p>
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
                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                      <Link
                        to={customerInquiryDetail(inq.id)}
                        className={`inline-flex min-h-[44px] items-center text-sm font-semibold ${
                          inquiryNeedsAttention(inq) ? 'text-luminexa-accent' : 'text-slate-700'
                        }`}
                      >
                        {inq.status === 'quoted'
                          ? 'Review quote →'
                          : inq.status === 'quote_accepted'
                            ? 'Pick a time →'
                            : 'View request →'}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget({ type: 'inquiry', item: inq })}
                        className="inline-flex min-h-[44px] shrink-0 items-center text-sm font-semibold text-red-600 hover:underline"
                      >
                        Delete quote
                      </button>
                    </div>
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
                    onCompactDelete={() => setRemoveTarget({ type: 'booking', item: booking })}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Delete quote?"
        message={removeDialogMessage}
        confirmLabel="Yes, delete"
        cancelLabel="Keep"
        tone="danger"
        busy={removing}
        onConfirm={confirmRemove}
        onClose={() => setRemoveTarget(null)}
      />
    </div>
  );
}
