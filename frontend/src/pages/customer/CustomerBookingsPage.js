import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerBookingCard from '../../components/customer/CustomerBookingCard';
import RescheduleBookingModal from '../../components/booking/RescheduleBookingModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import BookingsSubNav from '../../components/customer/BookingsSubNav';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { useToast } from '../../contexts/ToastContext';
import {
  canCancelBooking,
  canRescheduleBooking,
  isUpcomingBooking,
  isUntouchedBookingRequest,
} from '../../utils/customerBookings';
import { customerFind, customerHistory } from '../../utils/customerPaths';

export default function CustomerBookingsPage() {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
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
    setCancellingId(id);
    try {
      await jobsAPI.cancelBooking(id);
      showToast('Booking cancelled.', 'success');
      setConfirmCancelId(null);
      load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <BookingsSubNav />
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {upcoming.length === 0 ? (
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
              expanded={expandedId === b.id}
              onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              showActions
              onReschedule={canRescheduleBooking(b) ? () => setRescheduleBooking(b) : null}
              onCancel={canCancelBooking(b) ? () => setConfirmCancelId(b.id) : null}
              cancelling={cancellingId === b.id}
              onQuoteUpdated={load}
            />
          ))}
        </ul>
      )}

      <RescheduleBookingModal
        open={!!rescheduleBooking}
        booking={rescheduleBooking}
        audience="customer"
        onClose={() => setRescheduleBooking(null)}
        onRescheduled={(updated) => {
          const pending = isUntouchedBookingRequest(updated) || updated?.status === 'requested';
          showToast(
            pending
              ? 'New time submitted. Still waiting for the business to approve.'
              : 'Reschedule request sent. The business will confirm your new time.',
            'success',
          );
          setRescheduleBooking(null);
          load();
        }}
      />

      <ConfirmDialog
        open={confirmCancelId != null}
        title="Cancel this booking?"
        message="This frees up the time slot and notifies the business. This can't be undone."
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        busy={cancellingId === confirmCancelId}
        onConfirm={() => cancelBooking(confirmCancelId)}
        onClose={() => setConfirmCancelId(null)}
      />
    </div>
  );
}
