import React, { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';

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

export default function CustomerInvoicePaymentPrompt() {
  const [payment, setPayment] = useState(null);
  const [confirmedInvoice, setConfirmedInvoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await jobsAPI.getMyUnpaidInvoice();
      const next = res.data?.invoice ? res.data : null;
      const dismissedId = window.sessionStorage.getItem(DISMISSED_KEY);
      if (next && String(next.invoice.id) !== dismissedId) {
        setPayment(next);
      } else {
        setPayment(null);
      }
    } catch {
      // Payment prompting must never block the rest of the customer app.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncReturn = async () => {
      const params = new URLSearchParams(window.location.search);
      const result = params.get('paid');
      const sessionId = params.get('session_id');
      const bookingId = window.sessionStorage.getItem(PENDING_BOOKING_KEY);

      if (result === '1' && sessionId && bookingId) {
        try {
          const res = await jobsAPI.syncBookingInvoicePayment(bookingId, sessionId);
          if (!cancelled) setConfirmedInvoice(res.data);
          window.sessionStorage.removeItem(PENDING_BOOKING_KEY);
          window.sessionStorage.removeItem(DISMISSED_KEY);
        } catch {
          // Stripe's signed webhook remains the source-of-truth fallback.
        }
      } else if (result === '0' && bookingId) {
        window.sessionStorage.setItem(DISMISSED_KEY, bookingId);
      }

      if (result !== null) {
        const url = new URL(window.location.href);
        url.searchParams.delete('paid');
        url.searchParams.delete('session_id');
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
      <div
        className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-3 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-confirmed-title"
      >
        <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </div>
          <h2 id="payment-confirmed-title" className="mt-4 text-xl font-bold text-slate-900">
            Payment confirmed
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {formatMoney(confirmedInvoice.amount, confirmedInvoice.currency)} was paid successfully
            to {confirmedInvoice.provider_name}.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Invoice {confirmedInvoice.number} is now marked paid.
          </p>
          <button
            type="button"
            onClick={() => setConfirmedInvoice(null)}
            className="mt-5 min-h-[48px] w-full rounded-xl bg-emerald-700 font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!payment?.invoice) return null;

  const { booking_id: bookingId, invoice, organization_name: organizationName } = payment;

  const payNow = async () => {
    setBusy(true);
    setError('');
    try {
      const path = `${window.location.pathname}${window.location.search}`;
      window.sessionStorage.setItem(PENDING_BOOKING_KEY, String(bookingId));
      const res = await jobsAPI.payBookingInvoice(bookingId, {
        success_path: path,
        cancel_path: path,
      });
      if (!res.data?.checkout_url) throw new Error('No checkout URL returned.');
      window.location.href = res.data.checkout_url;
    } catch (err) {
      setError(parseApiError(err, 'Could not start payment.'));
      setBusy(false);
    }
  };

  const payLater = () => {
    window.sessionStorage.setItem(DISMISSED_KEY, String(invoice.id));
    setPayment(null);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-payment-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 10h18" />
          </svg>
        </div>
        <div className="mt-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Invoice ready
          </p>
          <h2 id="invoice-payment-title" className="mt-1 text-xl font-bold text-slate-900">
            Pay {formatMoney(invoice.amount, invoice.currency)}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {organizationName} sent invoice {invoice.number}.
          </p>
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-600">{payment.service_name || 'Service'}</span>
            <span className="font-semibold text-slate-900">
              {formatMoney(invoice.amount, invoice.currency)}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={payNow}
          className="mt-5 min-h-[50px] w-full rounded-xl bg-emerald-700 px-4 text-base font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? 'Opening secure payment…' : 'Pay now'}
        </button>
        <p className="mt-2 text-center text-xs text-slate-500">
          Apple Pay, Google Pay, or card through secure Stripe Checkout
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={payLater}
          className="mt-3 min-h-[44px] w-full rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Remind me later
        </button>
        {error && <p className="mt-3 text-center text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
