import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerBookingCard from '../../components/customer/CustomerBookingCard';
import RescheduleBookingModal from '../../components/booking/RescheduleBookingModal';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { useToast } from '../../contexts/ToastContext';
import {
  canCancelBooking,
  canRescheduleBooking,
  isUpcomingBooking,
} from '../../utils/customerBookings';
import { customerFind, customerHistory } from '../../utils/customerPaths';

export default function CustomerBookingsPage() {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    jobsAPI
      .listBookings()
      .then((res) => setBookings(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch(() => setError('Could not load your bookings'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = useMemo(() => bookings.filter(isUpcomingBooking), [bookings]);

  const cancelBooking = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    setCancellingId(id);
    try {
      await jobsAPI.cancelBooking(id);
      showToast('Booking cancelled.', 'success');
      load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {upcoming.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-slate-600">No upcoming appointments.</p>
          <Link
            to={customerFind()}
            className="mt-4 inline-flex min-h-[48px] items-center rounded-xl bg-luminexa-accent px-6 font-medium text-white"
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
              expanded={expandedId === b.id}
              onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              showActions
              onReschedule={canRescheduleBooking(b) ? () => setRescheduleBooking(b) : null}
              onCancel={canCancelBooking(b) ? cancelBooking : null}
              cancelling={cancellingId === b.id}
            />
          ))}
        </ul>
      )}

      <RescheduleBookingModal
        open={!!rescheduleBooking}
        booking={rescheduleBooking}
        onClose={() => setRescheduleBooking(null)}
        onRescheduled={() => {
          showToast('Appointment rescheduled.', 'success');
          load();
        }}
      />
    </div>
  );
}
