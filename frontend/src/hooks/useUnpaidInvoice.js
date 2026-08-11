import { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../utils/api';

/**
 * Latest unpaid online invoice for the signed-in customer (ignores session dismiss).
 */
export default function useUnpaidInvoice({ pollMs = 0 } = {}) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await jobsAPI.getMyUnpaidInvoice();
      setPayment(res.data?.invoice ? res.data : null);
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
