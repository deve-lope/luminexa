import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';

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

function lineItemDetail(item) {
  const bits = [];
  if (item.type) bits.push(item.type);
  if (item.brand) bits.push(item.brand);
  if (item.quantity != null && Number(item.quantity) !== 1) {
    bits.push(`${item.quantity} units`);
  }
  return bits.join(' · ');
}

/** Compact bill so the customer can review before paying. */
function InvoiceBillSummary({ invoice, organizationName, serviceName }) {
  if (!invoice) return null;
  const currency = invoice.currency || 'CAD';
  const taxLines = Array.isArray(invoice.tax_lines) ? invoice.tax_lines : [];
  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const subtotal = invoice.subtotal != null ? invoice.subtotal : invoice.amount;
  const extrasTotal = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const serviceFee = Math.max(0, (Number(subtotal) || 0) - extrasTotal);
  const discount = Number(invoice.discount) || 0;
  const provider = organizationName || invoice.provider_name || 'Provider';
  const jobLabel = serviceName || invoice.service_name || invoice.description || 'Service';

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-700">
            Your bill
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{provider}</p>
          <p className="truncate text-xs text-slate-500">
            {jobLabel}
            {invoice.number ? ` · ${invoice.number}` : ''}
          </p>
        </div>
        <p className="shrink-0 text-xl font-extrabold tabular-nums text-slate-900">
          {formatMoney(invoice.amount, currency)}
        </p>
      </div>

      <ul className="mt-3 space-y-2 border-t border-slate-200/80 pt-3 text-sm">
        {serviceFee > 0 && (
          <li className="flex justify-between gap-3">
            <span className="text-slate-600">{jobLabel}</span>
            <span className="tabular-nums text-slate-900">{formatMoney(serviceFee, currency)}</span>
          </li>
        )}
        {lineItems.map((item, idx) => (
          <li key={`li-${idx}`} className="flex justify-between gap-3">
            <span className="min-w-0 text-slate-600">
              <span className="block truncate">{item.name || item.description || 'Item'}</span>
              {lineItemDetail(item) ? (
                <span className="block text-xs text-slate-400">{lineItemDetail(item)}</span>
              ) : null}
            </span>
            <span className="shrink-0 tabular-nums text-slate-900">
              {formatMoney(item.amount, currency)}
            </span>
          </li>
        ))}
        {discount > 0 && (
          <li className="flex justify-between gap-3 text-teal-800">
            <span>Discount</span>
            <span className="tabular-nums">−{formatMoney(discount, currency)}</span>
          </li>
        )}
        {taxLines.map((tax, idx) => (
          <li key={`tax-${idx}`} className="flex justify-between gap-3">
            <span className="text-slate-600">{tax.name || tax.label || 'Tax'}</span>
            <span className="tabular-nums text-slate-900">
              {formatMoney(tax.amount, currency)}
            </span>
          </li>
        ))}
        {taxLines.length === 0 && Number(invoice.tax_total) > 0 && (
          <li className="flex justify-between gap-3">
            <span className="text-slate-600">Tax</span>
            <span className="tabular-nums text-slate-900">
              {formatMoney(invoice.tax_total, currency)}
            </span>
          </li>
        )}
        <li className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold">
          <span className="text-slate-900">Total due</span>
          <span className="tabular-nums text-slate-900">
            {formatMoney(invoice.amount, currency)}
          </span>
        </li>
      </ul>
    </div>
  );
}

async function finalizePaid(bookingId, paymentIntentId, onPaid) {
  const res = await jobsAPI.syncBookingInvoicePayment(bookingId, {
    payment_intent_id: paymentIntentId,
  });
  onPaid?.(res.data);
}

function PaySheetBody({
  bookingId,
  paymentIntentId,
  amountLabel,
  invoice,
  organizationName,
  serviceName,
  onPaid,
  onClose,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showCard, setShowCard] = useState(false);
  const [walletsReady, setWalletsReady] = useState(null);

  const confirmAndSync = useCallback(async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    try {
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: window.location.href,
        },
      });
      if (confirmError) {
        setError(confirmError.message || 'Payment failed.');
        setBusy(false);
        return;
      }
      const piId = paymentIntent?.id || paymentIntentId;
      if (paymentIntent?.status === 'succeeded' || piId) {
        await finalizePaid(bookingId, piId, onPaid);
        return;
      }
      setError('Payment is still processing. Check Bookings in a moment.');
      setBusy(false);
    } catch (err) {
      setError(parseApiError(err, 'Could not confirm payment.'));
      setBusy(false);
    }
  }, [stripe, elements, bookingId, paymentIntentId, onPaid]);

  const hasWallet =
    walletsReady && (walletsReady.applePay || walletsReady.googlePay);

  return (
    <div className="space-y-4">
      <InvoiceBillSummary
        invoice={invoice}
        organizationName={organizationName}
        serviceName={serviceName}
      />

      <div className={walletsReady === false ? 'hidden' : ''}>
        <ExpressCheckoutElement
          options={{
            buttonHeight: 52,
            buttonTheme: {
              applePay: 'black',
              googlePay: 'black',
            },
            buttonType: {
              applePay: 'plain',
              googlePay: 'pay',
            },
            paymentMethods: {
              applePay: 'always',
              googlePay: 'always',
              link: 'never',
              paypal: 'never',
              amazonPay: 'never',
              klarna: 'never',
            },
            layout: {
              maxColumns: 1,
              maxRows: 2,
              overflow: 'auto',
            },
          }}
          onReady={({ availablePaymentMethods }) => {
            const methods = availablePaymentMethods || {};
            const any = Boolean(methods.applePay) || Boolean(methods.googlePay);
            setWalletsReady(any ? methods : false);
            if (!any) setShowCard(true);
          }}
          onConfirm={confirmAndSync}
          onClick={({ resolve }) => {
            setError('');
            resolve();
          }}
        />
      </div>

      {hasWallet && (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            or card
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
      )}

      {!showCard && hasWallet ? (
        <button
          type="button"
          onClick={() => setShowCard(true)}
          className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Pay with debit or credit card
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmAndSync();
          }}
          className="space-y-3"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <PaymentElement
              options={{
                layout: {
                  type: 'tabs',
                  defaultCollapsed: false,
                },
                wallets: {
                  applePay: 'never',
                  googlePay: 'never',
                },
                fields: {
                  billingDetails: {
                    address: 'auto',
                  },
                },
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!stripe || !elements || busy}
            className="lx-btn-primary w-full min-h-[52px] text-base disabled:opacity-60"
          >
            {busy ? 'Processing…' : `Pay ${amountLabel}`}
          </button>
        </form>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Single-sheet pay: bill review + Apple Pay / Google Pay / card.
 */
export default function InvoiceStripePayModal({
  open,
  bookingId,
  invoice,
  organizationName,
  serviceName,
  onClose,
  onPaid,
}) {
  const [bootError, setBootError] = useState('');
  const [loading, setLoading] = useState(false);
  const [payConfig, setPayConfig] = useState(null);

  useEffect(() => {
    if (!open || !bookingId) return undefined;
    let cancelled = false;
    setBootError('');
    setPayConfig(null);
    setLoading(true);
    jobsAPI
      .payBookingInvoice(bookingId, {})
      .then((res) => {
        if (cancelled) return;
        const data = res.data || {};
        if (!data.client_secret || !data.publishable_key) {
          throw new Error(data.detail || 'Payment form is not available.');
        }
        setPayConfig(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setBootError(parseApiError(err, 'Could not start payment.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bookingId]);

  const stripePromise = useMemo(() => {
    if (!payConfig?.publishable_key) return null;
    return loadStripe(payConfig.publishable_key);
  }, [payConfig?.publishable_key]);

  if (!open) return null;

  const amountLabel = formatMoney(
    invoice?.amount ?? (payConfig?.amount_cents != null ? payConfig.amount_cents / 100 : 0),
    invoice?.currency || payConfig?.currency || 'CAD'
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stripe-pay-title"
      onClick={onClose}
    >
      <div
        className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[1.75rem] bg-white px-5 pb-[max(1.25rem,var(--lx-sab))] pt-3 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden />
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <h2 id="stripe-pay-title" className="text-sm font-semibold text-slate-900">
            Review & pay
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            Minimize
          </button>
        </div>

        {loading && (
          <div className="space-y-4 py-2">
            <InvoiceBillSummary
              invoice={invoice}
              organizationName={organizationName}
              serviceName={serviceName}
            />
            <div className="py-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              <p className="mt-4 text-sm text-slate-500">Preparing secure payment…</p>
            </div>
          </div>
        )}

        {bootError && (
          <div className="space-y-4 py-2">
            <InvoiceBillSummary
              invoice={invoice}
              organizationName={organizationName}
              serviceName={serviceName}
            />
            <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700">
              {bootError}
            </p>
            <button type="button" onClick={onClose} className="lx-btn-secondary w-full min-h-[48px]">
              Close
            </button>
          </div>
        )}

        {!loading && !bootError && payConfig && stripePromise && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: payConfig.client_secret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#0d9488',
                  colorBackground: '#ffffff',
                  colorText: '#1c2733',
                  colorDanger: '#b91c1c',
                  fontFamily: 'Manrope, system-ui, sans-serif',
                  borderRadius: '14px',
                  spacingUnit: '4px',
                },
              },
            }}
          >
            <PaySheetBody
              bookingId={bookingId}
              paymentIntentId={payConfig.payment_intent_id}
              amountLabel={amountLabel}
              invoice={invoice}
              organizationName={organizationName || invoice?.provider_name}
              serviceName={serviceName}
              onPaid={onPaid}
              onClose={onClose}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}
