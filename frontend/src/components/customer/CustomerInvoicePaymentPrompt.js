import React, { useCallback, useEffect, useState } from 'react';
import InvoiceStripePayModal from '../booking/InvoiceStripePayModal';
import { jobsAPI } from '../../utils/api';

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
 * Non-blocking unpaid-invoice chip. Expand to pay; otherwise browse normally.
 */
export default function CustomerInvoicePaymentPrompt() {
  const [payment, setPayment] = useState(null);
  const [confirmedInvoice, setConfirmedInvoice] = useState(null);
  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await jobsAPI.getMyUnpaidInvoice();
      const next = res.data?.invoice ? res.data : null;
      const dismissedId = window.sessionStorage.getItem(DISMISSED_KEY);
      if (next && String(next.booking_id) !== dismissedId) {
        window.sessionStorage.setItem(PENDING_BOOKING_KEY, String(next.booking_id));
        setPayment(next);
      } else {
        setPayment(null);
        setPayOpen(false);
      }
    } catch {
      /* never block the app */
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
          if (!cancelled) {
            setConfirmedInvoice(res.data);
            setPayment(null);
            setPayOpen(false);
          }
          window.sessionStorage.removeItem(PENDING_BOOKING_KEY);
          window.sessionStorage.removeItem(DISMISSED_KEY);
        } catch {
          /* webhook fallback */
        }
      } else if (paymentIntentId && bookingId && params.get('redirect_status') === 'succeeded') {
        try {
          const res = await jobsAPI.syncBookingInvoicePayment(bookingId, {
            payment_intent_id: paymentIntentId,
          });
          if (!cancelled) {
            setConfirmedInvoice(res.data);
            setPayment(null);
            setPayOpen(false);
          }
          window.sessionStorage.removeItem(PENDING_BOOKING_KEY);
          window.sessionStorage.removeItem(DISMISSED_KEY);
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
      if (!cancelled) await load();
    };

    syncReturn();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [load]);

  if (confirmedInvoice) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-3 sm:bottom-6">
        <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-teal-800 px-4 py-3 text-white shadow-xl ring-1 ring-teal-900/20">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Payment received</p>
            <p className="truncate text-xs text-teal-100">
              {formatMoney(confirmedInvoice.amount, confirmedInvoice.currency)} ·{' '}
              {confirmedInvoice.provider_name}
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

  if (!payment?.invoice) return null;

  const { booking_id: bookingId, invoice, organization_name: organizationName } = payment;
  const amountLabel = formatMoney(invoice.amount, invoice.currency);

  return (
    <>
      {/* Compact bar — does not block browsing */}
      {!payOpen && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-3 sm:bottom-6">
          <div
            className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl border border-teal-200 bg-white p-2 pl-3 shadow-xl shadow-slate-900/10"
            role="status"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                Pay {amountLabel}
              </p>
              <p className="truncate text-xs text-slate-500">
                {organizationName}
                {payment.service_name ? ` · ${payment.service_name}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              className="shrink-0 rounded-xl bg-teal-700 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Review & pay
            </button>
            <button
              type="button"
              aria-label="Hide for now"
              title="Hide for now"
              onClick={() => {
                window.sessionStorage.setItem(DISMISSED_KEY, String(bookingId));
                setPayment(null);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <InvoiceStripePayModal
        open={payOpen}
        bookingId={bookingId}
        invoice={invoice}
        organizationName={organizationName}
        serviceName={payment.service_name}
        onClose={() => setPayOpen(false)}
        onPaid={(paidInvoice) => {
          setPayOpen(false);
          setPayment(null);
          window.sessionStorage.removeItem(PENDING_BOOKING_KEY);
          window.sessionStorage.removeItem(DISMISSED_KEY);
          setConfirmedInvoice(paidInvoice);
        }}
      />
    </>
  );
}
