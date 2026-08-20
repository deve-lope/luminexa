import React, { useEffect, useState } from 'react';
import ServiceRatingForm from '../services/ServiceRatingForm';
import { businessesAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { providerCustomerKey } from '../../utils/providerRouteKey';

/**
 * Modal to rate a completed booking from History.
 */
export default function BookingRateModal({
  open,
  booking,
  onClose,
  onSubmitted,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    // Keep the dialog in view near the top of the viewport (mobile sheet used to sit at bottom).
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, submitting, onClose]);

  if (!open || !booking) return null;

  const providerKey = providerCustomerKey(booking);

  const handleSubmit = async (payload) => {
    if (!providerKey || !booking.service) return;
    setSubmitting(true);
    setError(null);
    try {
      await businessesAPI.submitServiceReview(providerKey, booking.service, {
        ...payload,
        booking_id: booking.id,
      });
      onSubmitted?.();
      onClose?.();
    } catch (e) {
      setError(parseApiError(e, 'Could not submit rating.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-6 sm:items-center sm:pt-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-booking-title"
      onClick={() => !submitting && onClose?.()}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="rate-booking-title" className="text-lg font-bold text-slate-900">
              Rate this service
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {booking.service_name}
              {booking.organization_name ? ` · ${booking.organization_name}` : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-4">
          <ServiceRatingForm onSubmit={handleSubmit} submitting={submitting} />
        </div>
      </div>
    </div>
  );
}
