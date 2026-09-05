import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerBookingCard from '../../components/customer/CustomerBookingCard';
import BookingsSubNav from '../../components/customer/BookingsSubNav';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { jobsAPI } from '../../utils/api';
import { isAttendanceFollowUp, isFutureUpcomingBooking } from '../../utils/customerBookings';
import {
  customerBookingDetail,
  customerCompleted,
  customerFind,
  customerQuotes,
} from '../../utils/customerPaths';

export default function CustomerBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listBookings()
      .then((res) => {
        setBookings(Array.isArray(res.data) ? res.data : res.data?.results || []);
        setError(null);
      })
      .catch(() => setError('Could not load your bookings'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { followUps, upcoming } = useMemo(() => {
    const followUpRows = [];
    const upcomingRows = [];
    for (const booking of bookings) {
      if (isAttendanceFollowUp(booking)) followUpRows.push(booking);
      else if (isFutureUpcomingBooking(booking)) upcomingRows.push(booking);
    }
    followUpRows.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
    upcomingRows.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    return { followUps: followUpRows, upcoming: upcomingRows };
  }, [bookings]);

  const handleAttendanceAnswered = useCallback((updated) => {
    if (!updated?.id) return;
    setBookings((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)),
    );
  }, []);

  const hasItems = followUps.length > 0 || upcoming.length > 0;

  return (
    <div className="space-y-4">
      <BookingsSubNav />
      <p className="text-sm text-slate-600">
        Confirmed appointments coming up. Open quotes and price requests are under{' '}
        <Link to={customerQuotes()} className="font-medium text-teal-700">
          Quotes
        </Link>
        ; finished jobs and bills are under{' '}
        <Link to={customerCompleted()} className="font-medium text-teal-700">
          Completed
        </Link>
        .
      </p>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading bookings">
          <Skeleton className="h-24 rounded-3xl" />
          <SkeletonList count={2} />
        </div>
      ) : !hasItems ? (
        <div className="lx-empty">
          <p className="text-slate-600">No upcoming appointments.</p>
          <p className="mt-1 text-sm text-slate-500">
            When you and a business both confirm a time, it appears here. Waiting on a price or
            approval? Check{' '}
            <Link to={customerQuotes()} className="font-medium text-luminexa-accent">
              Quotes
            </Link>
            .
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
          {followUps.length > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-800">
                Confirm your visit
              </h2>
              <p className="mb-3 text-sm text-slate-500">
                These appointments have passed — let us know if the provider showed up.
              </p>
              <ul className="space-y-3">
                {followUps.map((b) => (
                  <CustomerBookingCard
                    key={b.id}
                    booking={b}
                    compact
                    detailTo={customerBookingDetail(b.id)}
                    onAttendanceAnswered={handleAttendanceAnswered}
                  />
                ))}
              </ul>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Coming up
              </h2>
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
          )}
        </>
      )}
    </div>
  );
}
