import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerBookingCard from '../../components/customer/CustomerBookingCard';
import BookingsSubNav from '../../components/customer/BookingsSubNav';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { jobsAPI } from '../../utils/api';
import { isUpcomingBooking } from '../../utils/customerBookings';
import { customerBookingDetail, customerFind, customerHistory } from '../../utils/customerPaths';

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

  const upcoming = useMemo(() => bookings.filter(isUpcomingBooking), [bookings]);

  return (
    <div className="space-y-4">
      <BookingsSubNav />
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading bookings">
          <Skeleton className="h-24 rounded-3xl" />
          <SkeletonList count={2} />
        </div>
      ) : upcoming.length === 0 ? (
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
      )}
    </div>
  );
}
