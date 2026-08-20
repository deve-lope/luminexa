import { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../utils/api';
import { requestRatePrompt } from '../utils/ratePrompt';

export const RECENTLY_PAID_BOOKING_KEY = 'luminexa.recentlyPaidInvoiceBookingId';

export function markInvoiceBookingPaid(bookingId) {
  if (bookingId == null) return;
  window.sessionStorage.setItem(RECENTLY_PAID_BOOKING_KEY, String(bookingId));
  requestRatePrompt(bookingId);
}

/**
 * Latest unpaid online invoice for the signed-in customer (ignores session dismiss).
 */
export default function useUnpaidInvoice({ pollMs = 0 } = {}) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await jobsAPI.getMyUnpaidInvoice();
      const next = res.data?.invoice ? res.data : null;
      const paidId = window.sessionStorage.getItem(RECENTLY_PAID_BOOKING_KEY);
      if (next && paidId && String(next.booking_id) === paidId) {
        setPayment(null);
        return;
      }
      setPayment(next);
    } catch {
      setPayment(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!pollMs) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);

  return { payment, loading, reload: load, clear: () => setPayment(null) };
}
