import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerBookingCard from '../../components/customer/CustomerBookingCard';
import BookingsSubNav from '../../components/customer/BookingsSubNav';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { jobsAPI } from '../../utils/api';
import { isUpcomingBooking } from '../../utils/customerBookings';
import { customerBookingDetail, customerFind, customerHistory, customerInquiryDetail } from '../../utils/customerPaths';
import { formatWhen } from '../../utils/datetime';

const ACTIVE_INQUIRY_STATUSES = new Set(['pending', 'active', 'quoted', 'quote_accepted']);

function inquiryNeedsAttention(inq) {
  return inq.status === 'quoted' || inq.status === 'quote_accepted';
}

export default function CustomerBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([jobsAPI.listBookings(), jobsAPI.listMyServiceInquiries()])
      .then(([bookingsRes, inquiriesRes]) => {
        setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : bookingsRes.data?.results || []);
        setInquiries(Array.isArray(inquiriesRes.data) ? inquiriesRes.data : []);
        setError(null);
      })
      .catch(() => setError('Could not load your bookings'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = useMemo(() => bookings.filter(isUpcomingBooking), [bookings]);
  const activeInquiries = useMemo(
    () => inquiries.filter((inq) => ACTIVE_INQUIRY_STATUSES.has(inq.status)),
    [inquiries]
  );

  return (
    <div className="space-y-4">
      <BookingsSubNav />
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading bookings">
          <Skeleton className="h-24 rounded-3xl" />
          <SkeletonList count={2} />
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
                  </li>
                ))}
              </ul>
            </section>
          )}

          {upcoming.length === 0 && activeInquiries.length === 0 ? (
            <div className="lx-empty">
              <p className="text-slate-600">No upcoming appointments.</p>
              <Link
                to={customerFind()}
                className="lx-btn-primary mt-4 inline-flex min-h-[48px] items-center px-6"
              >
                Find a service
              </Link>
              <p className="mt-4 text-sm text-slate-500">
                Past bookings and requests are in{' '}
                <Link to={customerHistory()} className="font-medium text-luminexa-accent">
                  History
                </Link>
                .
              </p>
            </div>
          ) : (
            upcoming.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Appointments</h2>
                <ul className="space-y-3">
                  {upcoming.map((b) => (
                    <CustomerBookingCard
                      key={b.id}
                      booking={b}
                      compact
                      detailTo={customerBookingDetail(b.id)}
                    />
                  ))}
                </ul>
              </section>
            )
          )}
        </>
      )}
    </div>
  );
}
