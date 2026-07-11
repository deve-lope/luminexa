import React, { useMemo, useState } from 'react';
import { formatServicePrice } from '../../utils/serviceDisplay';

/**
 * Provider modal: set final invoice amount when completing a job.
 * Supports fixed / range / quote services.
 */
export default function CompleteBookingInvoiceModal({
  open,
  booking,
  busy = false,
  onClose,
  onConfirm,
}) {
  const catalogHint = useMemo(() => {
    if (!booking) return '';
    return formatServicePrice(
      {
        pricing_type: booking.service_pricing_type || 'fixed',
        base_price: booking.service_base_price,
        price_max: booking.service_price_max,
        show_price: true,
      },
      undefined,
      { forceShowPrice: true }
    );
  }, [booking]);

  const defaultAmount = useMemo(() => {
    if (!booking) return '';
    const type = booking.service_pricing_type || 'fixed';
    if (type === 'quote') return '';
    const n = Number(booking.service_base_price);
    return Number.isFinite(n) ? n.toFixed(2) : '';
  }, [booking]);

  const [amount, setAmount] = useState(defaultAmount);
  const [notes, setNotes] = useState('');
  const [markPaid, setMarkPaid] = useState(false);
  const [error, setError] = useState(null);

  // Reset when opened for a different booking
  React.useEffect(() => {
    if (open) {
      setAmount(defaultAmount);
      setNotes('');
      setMarkPaid(false);
      setError(null);
    }
  }, [open, defaultAmount, booking?.id]);

  if (!open || !booking) return null;

  const pricingType = booking.service_pricing_type || 'fixed';
  const amountHelp =
    pricingType === 'range'
      ? `Catalog estimate: ${catalogHint || 'range'}. Enter the final amount for this job.`
      : pricingType === 'quote'
        ? 'This service is quote-based. Enter the agreed final amount.'
        : catalogHint
          ? `Catalog price: ${catalogHint}. Adjust if the final amount differs.`
          : 'Enter the final amount for this job.';

  const submit = (e) => {
    e.preventDefault();
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid amount (0 or more).');
      return;
    }
    setError(null);
    onConfirm?.({
      amount: parsed.toFixed(2),
      notes: notes.trim(),
      mark_paid: markPaid,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-invoice-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id="complete-invoice-title" className="text-lg font-semibold text-slate-900">
          Complete & invoice
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Mark <span className="font-medium">{booking.service_name}</span> complete and issue an
          invoice the customer can download.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="invoice-amount" className="mb-1 block text-sm font-medium text-slate-700">
              Final amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                $
              </span>
              <input
                id="invoice-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-slate-200 py-2 pl-7 pr-3 text-base outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
                required
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">{amountHelp}</p>
          </div>

          <div>
            <label htmlFor="invoice-notes" className="mb-1 block text-sm font-medium text-slate-700">
              Notes (optional)
            </label>
            <textarea
              id="invoice-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Extra bagging, larger yard…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={markPaid}
              onChange={(e) => setMarkPaid(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-luminexa-accent"
            />
            Mark as paid (cash / e-transfer already received)
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="min-h-[48px] flex-1 rounded-xl border border-slate-200 font-medium text-slate-700 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="min-h-[48px] flex-1 rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Complete & issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
