import React, { useMemo, useState } from 'react';
import { formatServicePrice } from '../../utils/serviceDisplay';
import { jobsAPI } from '../../utils/api';

function money(n, currency = 'CAD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'CAD',
    }).format(Number(n) || 0);
  } catch {
    return `$${(Number(n) || 0).toFixed(2)}`;
  }
}

function rateLabel(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '';
  const pct = (n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 2);
  return `${pct}%`;
}

/**
 * Provider modal: POS-style complete + invoice with tax from business address.
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

  const defaultSubtotal = useMemo(() => {
    if (!booking) return '';
    const type = booking.service_pricing_type || 'fixed';
    if (type === 'quote') return '';
    const n = Number(booking.service_base_price);
    return Number.isFinite(n) ? n.toFixed(2) : '';
  }, [booking]);

  const [subtotal, setSubtotal] = useState(defaultSubtotal);
  const [notes, setNotes] = useState('');
  const [markPaid, setMarkPaid] = useState(false);
  const [error, setError] = useState(null);
  const [taxPreview, setTaxPreview] = useState(null);
  const [taxLoading, setTaxLoading] = useState(false);

  React.useEffect(() => {
    if (open) {
      setSubtotal(defaultSubtotal);
      setNotes('');
      setMarkPaid(false);
      setError(null);
      setTaxPreview(null);
    }
  }, [open, defaultSubtotal, booking?.id]);

  React.useEffect(() => {
    if (!open || !booking?.id) return undefined;
    let cancelled = false;
    setTaxLoading(true);
    jobsAPI
      .getBookingInvoice(booking.id)
      .then((res) => {
        if (cancelled) return;
        const suggestion = res.data?.suggestion || res.data;
        if (suggestion?.tax_lines || suggestion?.tax_country) {
          setTaxPreview(suggestion);
        }
      })
      .catch(() => {
        if (!cancelled) setTaxPreview(null);
      })
      .finally(() => {
        if (!cancelled) setTaxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, booking?.id]);

  const liveTax = useMemo(() => {
    const lines = taxPreview?.tax_lines || [];
    const currency = taxPreview?.currency || 'CAD';
    const parsed = Number(subtotal);
    const base = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    if (!lines.length) {
      return {
        currency,
        lines: [],
        taxTotal: 0,
        total: base,
        region: taxPreview?.tax_region || '',
        country: taxPreview?.tax_country || '',
        businessState: taxPreview?.business_state || '',
      };
    }
    let taxTotal = 0;
    const computed = lines.map((line) => {
      const rate = Number(line.rate);
      const amount = Number.isFinite(rate) ? Math.round(base * rate * 100) / 100 : Number(line.amount) || 0;
      taxTotal += amount;
      return { ...line, amount };
    });
    taxTotal = Math.round(taxTotal * 100) / 100;
    return {
      currency,
      lines: computed,
      taxTotal,
      total: Math.round((base + taxTotal) * 100) / 100,
      region: taxPreview?.tax_region || '',
      country: taxPreview?.tax_country || '',
      businessState: taxPreview?.business_state || '',
    };
  }, [subtotal, taxPreview]);

  if (!open || !booking) return null;

  const pricingType = booking.service_pricing_type || 'fixed';
  const amountHelp =
    pricingType === 'range'
      ? `Catalog estimate: ${catalogHint || 'range'}. Enter the pre-tax amount for this job.`
      : pricingType === 'quote'
        ? 'This service is quote-based. Enter the agreed pre-tax amount.'
        : catalogHint
          ? `Catalog price: ${catalogHint}. Adjust the pre-tax amount if needed.`
          : 'Enter the pre-tax amount for this job.';

  const submit = (e) => {
    e.preventDefault();
    const parsed = Number(subtotal);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid subtotal (0 or more).');
      return;
    }
    setError(null);
    onConfirm?.({
      subtotal: parsed.toFixed(2),
      amount: parsed.toFixed(2), // legacy alias = pre-tax; backend recalculates total
      notes: notes.trim(),
      mark_paid: markPaid,
    });
  };

  const jurisdictionHint = liveTax.region
    ? `Tax from business address (${liveTax.country || '—'}-${liveTax.region})`
    : liveTax.businessState
      ? `Business region: ${liveTax.businessState}`
      : 'Set your business province/state in settings to apply tax automatically.';

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
          Ring up <span className="font-medium">{booking.service_name}</span> like a basic POS.
          Tax uses your business address.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="invoice-subtotal" className="mb-1 block text-sm font-medium text-slate-700">
              Subtotal (before tax)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                $
              </span>
              <input
                id="invoice-subtotal"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-slate-200 py-2 pl-7 pr-3 text-base outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
                required
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">{amountHelp}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Totals</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-3 text-slate-700">
                <span>Subtotal</span>
                <span>{money(Number(subtotal) || 0, liveTax.currency)}</span>
              </div>
              {taxLoading && <p className="text-xs text-slate-500">Loading tax rates…</p>}
              {!taxLoading && liveTax.lines.length === 0 && (
                <p className="text-xs text-slate-500">{jurisdictionHint}</p>
              )}
              {liveTax.lines.map((line) => (
                <div key={line.code || line.name} className="flex justify-between gap-3 text-slate-700">
                  <span>
                    {line.name || line.code}
                    {line.rate != null ? ` (${rateLabel(line.rate)})` : ''}
                  </span>
                  <span>{money(line.amount, liveTax.currency)}</span>
                </div>
              ))}
              {liveTax.lines.length > 0 && (
                <p className="text-[11px] text-slate-500">{jurisdictionHint}</p>
              )}
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold text-slate-900">
                <span>Total due</span>
                <span>{money(liveTax.total, liveTax.currency)}</span>
              </div>
            </div>
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
