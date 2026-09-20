import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerBookingCard from '../../components/customer/CustomerBookingCard';
import BookingsSubNav from '../../components/customer/BookingsSubNav';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { jobsAPI } from '../../utils/api';
import { isCompletedBooking } from '../../utils/customerBookings';
import { customerBookingDetail, customerFind } from '../../utils/customerPaths';

export default function CustomerCompletedPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listBookings()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setBookings(list);
        setError(null);
      })
      .catch(() => setError('Could not load completed services.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completed = useMemo(
    () =>
      bookings
        .filter(isCompletedBooking)
        .sort((a, b) => new Date(b.start_at) - new Date(a.start_at)),
    [bookings],
  );

  return (
    <div className="space-y-4">
      <BookingsSubNav />
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading completed services">
          <Skeleton className="h-5 w-40" />
          <SkeletonList count={2} />
        </div>
      ) : completed.length === 0 ? (
        <div className="lx-empty">
          <p className="text-slate-600">No finished jobs yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            When a job is marked done, bills and reviews show up here.
          </p>
          <Link
            to={customerFind()}
            className="lx-btn-primary mt-4 inline-flex min-h-[48px] items-center px-6"
          >
            Find a service
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {completed.map((booking) => (
            <CustomerBookingCard
              key={booking.id}
              booking={booking}
              compact
              detailTo={customerBookingDetail(booking.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
