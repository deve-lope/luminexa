import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CustomerBookingCard from '../../components/customer/CustomerBookingCard';
import RescheduleBookingModal from '../../components/booking/RescheduleBookingModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { useToast } from '../../contexts/ToastContext';
import {
  canCancelBooking,
  canRescheduleBooking,
  isUntouchedBookingRequest,
} from '../../utils/customerBookings';
import { customerBookings } from '../../utils/customerPaths';
import {
  dismissNotificationsForBooking,
  emitNotificationsChanged,
} from '../../utils/customerNotifications';

export default function CustomerBookingDetailPage() {
  const { bookingId } = useParams();
  const { showToast } = useToast();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(() => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    jobsAPI
      .getBooking(bookingId)
      .then((res) => {
        setBooking(res.data);
        // Backend dismisses booking-update alerts on retrieve; refresh bell/home/tab.
        emitNotificationsChanged();
      })
      .catch((err) => {
        setBooking(null);
        setError(parseApiError(err, 'Could not load this booking.'));
      })
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!bookingId) return undefined;
    let cancelled = false;
    // Client fallback if retrieve dismiss was missed (older API / race).
    dismissNotificationsForBooking(bookingId).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const cancelBooking = async () => {
    if (!booking) return;
    setCancelling(true);
    try {
      await jobsAPI.cancelBooking(booking.id);
      showToast('Booking cancelled.', 'success');
      setConfirmCancel(false);
      load();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !booking) {
    return <p className="py-8 text-center text-slate-500">Loading booking…</p>;
  }

  if (error && !booking) {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-red-600">{error}</p>
        <Link to={customerBookings()} className="lx-link inline-block">
          ← All bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to={customerBookings()} className="lx-link inline-flex min-h-[40px] items-center">
        ← All bookings
      </Link>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <ul className="space-y-3">
        <CustomerBookingCard
          booking={booking}
          expanded={expanded}
          onToggleExpand={() => setExpanded((v) => !v)}
          showActions
          onReschedule={canRescheduleBooking(booking) ? () => setRescheduleOpen(true) : null}
          onCancel={canCancelBooking(booking) ? () => setConfirmCancel(true) : null}
          cancelling={cancelling}
          onQuoteUpdated={load}
          onReviewSubmitted={load}
        />
      </ul>

      <RescheduleBookingModal
        open={rescheduleOpen}
        booking={booking}
        audience="customer"
        onClose={() => setRescheduleOpen(false)}
        onRescheduled={(updated) => {
          const pending = isUntouchedBookingRequest(updated) || updated?.status === 'requested';
          showToast(
            pending
              ? 'New time submitted. Still waiting for the business to approve.'
              : 'Reschedule request sent. The business will confirm your new time.',
            'success',
          );
          setRescheduleOpen(false);
          load();
        }}
      />

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this booking?"
        message="This frees up the time slot and notifies the business. This can't be undone."
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        busy={cancelling}
        onConfirm={cancelBooking}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
}
