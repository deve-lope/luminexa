import React, { useMemo, useState } from 'react';
import { formatServicePrice } from '../../utils/serviceDisplay';
import { costLinesToBillItems } from '../../utils/jobBillItems';
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

function emptyDraft() {
  return { name: '', type: '', brand: '', quantity: '1', amount: '' };
}

function itemDetail(item) {
  const bits = [];
  if (item.type) bits.push(item.type);
  if (item.brand) bits.push(item.brand);
  if (item.quantity != null && Number(item.quantity) !== 1) {
    bits.push(`${item.quantity} units`);
  }
  return bits.join(' · ');
}

/**
 * Provider modal: POS-style complete + invoice with tax from business address.
 * Supports optional extras via "Add to bill".
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
        currency: booking.currency,
      },
      booking.currency,
      { forceShowPrice: true }
    );
  }, [booking]);

  const defaultServiceFee = useMemo(() => {
    if (!booking) return '';
    const type = booking.service_pricing_type || 'fixed';
    if (type === 'quote') return '';
    const n = Number(booking.service_base_price);
    return Number.isFinite(n) ? n.toFixed(2) : '';
  }, [booking]);

  const [serviceFee, setServiceFee] = useState(defaultServiceFee);
  const [lineItems, setLineItems] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState('');
  const [markPaid, setMarkPaid] = useState(false);
  const [error, setError] = useState(null);
  const [taxPreview, setTaxPreview] = useState(null);
  const [taxLoading, setTaxLoading] = useState(false);

  React.useEffect(() => {
    if (open) {
      setServiceFee(defaultServiceFee);
      setLineItems(costLinesToBillItems(booking?.cost_lines));
      setDraft(emptyDraft());
      setAdding(false);
      setNotes('');
      setMarkPaid(false);
      setError(null);
      setTaxPreview(null);
    }
  }, [open, defaultServiceFee, booking?.id]);

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

  const extrasTotal = useMemo(
    () =>
      lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [lineItems]
  );

  const preTaxSubtotal = useMemo(() => {
    const fee = Number(serviceFee);
    const base = Number.isFinite(fee) && fee >= 0 ? fee : 0;
    return Math.round((base + extrasTotal) * 100) / 100;
  }, [serviceFee, extrasTotal]);

  const liveTax = useMemo(() => {
    const lines = taxPreview?.tax_lines || [];
    const currency = taxPreview?.currency || 'CAD';
    const base = preTaxSubtotal;
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
      const amount = Number.isFinite(rate)
        ? Math.round(base * rate * 100) / 100
        : Number(line.amount) || 0;
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
  }, [preTaxSubtotal, taxPreview]);

  if (!open || !booking) return null;

  const pricingType = booking.service_pricing_type || 'fixed';
  const amountHelp =
    pricingType === 'range'
      ? `Catalog estimate: ${catalogHint || 'range'}. Enter the pre-tax service fee.`
      : pricingType === 'quote'
        ? 'This service is quote-based. Enter the agreed pre-tax service fee.'
        : catalogHint
          ? `Catalog price: ${catalogHint}. Adjust the service fee if needed.`
          : 'Enter the pre-tax service fee for this job.';

  const addItemToBill = () => {
    const name = draft.name.trim();
    if (!name) {
      setError('Enter a name for the bill item (e.g. Oil change).');
      return;
    }
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid amount for the bill item.');
      return;
    }
    const qty = Number(draft.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    setError(null);
    setLineItems((prev) => [
      ...prev,
      {
        name,
        type: draft.type.trim(),
        brand: draft.brand.trim(),
        quantity: Number.isInteger(qty) ? qty : Math.round(qty * 100) / 100,
        amount: amount.toFixed(2),
      },
    ]);
    setDraft(emptyDraft());
    setAdding(false);
  };

  const removeItem = (index) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = (e) => {
    e.preventDefault();
    const parsed = Number(serviceFee);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid service fee (0 or more).');
      return;
    }
    setError(null);
    onConfirm?.({
      service_fee: parsed.toFixed(2),
      line_items: lineItems,
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
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
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
            <label htmlFor="invoice-service-fee" className="mb-1 block text-sm font-medium text-slate-700">
              Service fee (before tax)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                $
              </span>
              <input
                id="invoice-service-fee"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={serviceFee}
                onChange={(e) => setServiceFee(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-slate-200 py-2 pl-7 pr-3 text-base outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
                required
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">{amountHelp}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">Parts & extras</p>
              {!adding && (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(true);
                    setError(null);
                  }}
                  className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Add to bill
                </button>
              )}
            </div>

            {lineItems.length > 0 && (
              <ul className="space-y-2">
                {lineItems.map((item, idx) => (
                  <li
                    key={`${item.name}-${idx}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      {itemDetail(item) ? (
                        <p className="mt-0.5 text-xs text-slate-500">{itemDetail(item)}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {money(item.amount, liveTax.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-white hover:text-red-600"
                        aria-label={`Remove ${item.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {adding && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="bill-item-name" className="mb-1 block text-xs font-medium text-slate-600">
                      Item name
                    </label>
                    <input
                      id="bill-item-name"
                      type="text"
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Oil change"
                      className="w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="bill-item-type" className="mb-1 block text-xs font-medium text-slate-600">
                      Type (optional)
                    </label>
                    <input
                      id="bill-item-type"
                      type="text"
                      value={draft.type}
                      onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                      placeholder="e.g. oil"
                      className="w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="bill-item-brand" className="mb-1 block text-xs font-medium text-slate-600">
                      Brand (optional)
                    </label>
                    <input
                      id="bill-item-brand"
                      type="text"
                      value={draft.brand}
                      onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                      placeholder="e.g. Castrol"
                      className="w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="bill-item-qty" className="mb-1 block text-xs font-medium text-slate-600">
                      Units
                    </label>
                    <input
                      id="bill-item-qty"
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={draft.quantity}
                      onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                      className="w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="bill-item-amount" className="mb-1 block text-xs font-medium text-slate-600">
                      Total ($)
                    </label>
                    <input
                      id="bill-item-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={draft.amount}
                      onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                      placeholder="100.00"
                      className="w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addItemToBill}
                    className="min-h-[44px] flex-1 rounded-xl bg-slate-900 text-sm font-semibold text-white"
                  >
                    Add item
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setDraft(emptyDraft());
                      setError(null);
                    }}
                    className="min-h-[44px] flex-1 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!adding && lineItems.length === 0 && (
              <p className="text-xs text-slate-500">
                Optional — add oil, filters, parts, or other extras to the bill.
              </p>
            )}
            {!adding && lineItems.length > 0 && booking?.cost_lines?.length > 0 && (
              <p className="text-xs text-slate-500">
                Includes items added on this job. You can still change them before issuing.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Totals</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-3 text-slate-700">
                <span>Service fee</span>
                <span>{money(Number(serviceFee) || 0, liveTax.currency)}</span>
              </div>
              {extrasTotal > 0 && (
                <div className="flex justify-between gap-3 text-slate-700">
                  <span>Parts & extras</span>
                  <span>{money(extrasTotal, liveTax.currency)}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 text-slate-700">
                <span>Subtotal</span>
                <span>{money(preTaxSubtotal, liveTax.currency)}</span>
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
