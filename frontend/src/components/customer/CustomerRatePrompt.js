import React, { useCallback, useEffect, useRef, useState } from 'react';
import BookingRateModal from '../booking/BookingRateModal';
import { jobsAPI } from '../../utils/api';
import {
  RATE_PROMPT_EVENT,
  consumePendingRatePrompt,
  markRatePromptRated,
  markRatePromptShown,
  pickRatePromptBooking,
  shouldPromptRate,
} from '../../utils/ratePrompt';

/**
 * After a paid invoice: ask the customer to rate.
 * If they skip that day, ask once more the next time they open the app.
 */
export default function CustomerRatePrompt() {
  const [booking, setBooking] = useState(null);
  const openedRef = useRef(false);

  const openIfEligible = useCallback((next, { force = false } = {}) => {
    if (!next?.can_rate || openedRef.current) return;
    if (!force && !shouldPromptRate(next)) return;
    openedRef.current = true;
    markRatePromptShown(next.id);
    setBooking(next);
  }, []);

  const loadBooking = useCallback(
    async (bookingId) => {
      try {
        const res = await jobsAPI.getBooking(bookingId);
        openIfEligible(res.data, { force: true });
      } catch {
        /* still allow browsing */
      }
    },
    [openIfEligible],
  );

  useEffect(() => {
    const pendingId = consumePendingRatePrompt();
    if (pendingId) {
      loadBooking(pendingId);
    } else {
      jobsAPI
        .listBookings({ status: 'completed' })
        .then((res) => {
          if (openedRef.current) return;
          const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
          openIfEligible(pickRatePromptBooking(list));
        })
        .catch(() => {});
    }

    const onPay = (event) => {
      const id = event?.detail?.bookingId;
      if (id) loadBooking(id);
    };
    window.addEventListener(RATE_PROMPT_EVENT, onPay);
    return () => window.removeEventListener(RATE_PROMPT_EVENT, onPay);
  }, [loadBooking, openIfEligible]);

  if (!booking) return null;

  return (
    <BookingRateModal
      open
      booking={booking}
      onClose={() => setBooking(null)}
      onSubmitted={() => {
        markRatePromptRated(booking.id);
        setBooking(null);
      }}
    />
  );
}
