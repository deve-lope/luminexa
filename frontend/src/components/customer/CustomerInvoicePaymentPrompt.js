import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { jobsAPI } from '../../utils/api';
import { dismissNotificationsForBooking } from '../../utils/customerNotifications';
import { markInvoiceBookingPaid } from '../../hooks/useUnpaidInvoice';

const DISMISSED_KEY = 'luminexa.dismissedInvoicePrompt';
const PENDING_BOOKING_KEY = 'luminexa.pendingInvoiceBookingId';

function formatMoney(amount, currency = 'CAD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'CAD',
    }).format(Number(amount) || 0);
  } catch {
    return `$${(Number(amount) || 0).toFixed(2)}`;
  }
}

/**
 * Handles Stripe Checkout return and a brief "Payment received" toast.
 * Unpaid invoices stay on Home / booking detail — do not follow other tabs.
 */
export default function CustomerInvoicePaymentPrompt() {
  const location = useLocation();
  const [confirmedInvoice, setConfirmedInvoice] = useState(null);
  const skipPathClearRef = useRef(true);

  const acknowledgePaid = useCallback((invoice, bookingId) => {
    setConfirmedInvoice(invoice || {});
    const id = bookingId || window.sessionStorage.getItem(PENDING_BOOKING_KEY);
    window.sessionStorage.removeItem(PENDING_BOOKING_KEY);
    window.sessionStorage.removeItem(DISMISSED_KEY);
    if (id) {
      markInvoiceBookingPaid(id);
      dismissNotificationsForBooking(id);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncReturn = async () => {
      const params = new URLSearchParams(window.location.search);
      const result = params.get('paid');
      const sessionId = params.get('session_id');
      const paymentIntentId =
        params.get('payment_intent') || params.get('payment_intent_id');
      const bookingId = window.sessionStorage.getItem(PENDING_BOOKING_KEY);

      if (result === '1' && sessionId && bookingId) {
        try {
          const res = await jobsAPI.syncBookingInvoicePayment(bookingId, sessionId);
          if (!cancelled) acknowledgePaid(res.data, bookingId);
        } catch {
          /* webhook fallback */
        }
      } else if (paymentIntentId && bookingId && params.get('redirect_status') === 'succeeded') {
        try {
          const res = await jobsAPI.syncBookingInvoicePayment(bookingId, {
            payment_intent_id: paymentIntentId,
          });
          if (!cancelled) acknowledgePaid(res.data, bookingId);
        } catch {
          /* webhook fallback */
        }
      } else if (result === '0' && bookingId) {
        window.sessionStorage.setItem(DISMISSED_KEY, bookingId);
      }

      if (result !== null || paymentIntentId) {
        const url = new URL(window.location.href);
        ['paid', 'session_id', 'payment_intent', 'payment_intent_client_secret', 'redirect_status'].forEach(
          (k) => url.searchParams.delete(k)
        );
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    };

    syncReturn();
    return () => {
      cancelled = true;
    };
  }, [acknowledgePaid]);

  useEffect(() => {
    if (skipPathClearRef.current) {
      skipPathClearRef.current = false;
      return;
    }
    setConfirmedInvoice(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!confirmedInvoice) return undefined;
    const id = window.setTimeout(() => setConfirmedInvoice(null), 4000);
    return () => window.clearTimeout(id);
  }, [confirmedInvoice]);

  if (!confirmedInvoice) return null;

  return (
    <div className="lx-fixed-above-tabs pointer-events-none flex justify-center px-3 lg:bottom-6">
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-teal-800 px-4 py-3 text-white shadow-xl ring-1 ring-teal-900/20">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m5 12 4 4L19 6" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Payment received</p>
          <p className="truncate text-xs text-teal-100">
            {formatMoney(confirmedInvoice.amount, confirmedInvoice.currency)}
            {confirmedInvoice.provider_name ? ` · ${confirmedInvoice.provider_name}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmedInvoice(null)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-teal-100 hover:bg-white/10"
        >
          OK
        </button>
      </div>
    </div>
  );
}
