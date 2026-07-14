import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';

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

function statusLabel(status) {
  if (status === 'paid') return 'Paid';
  if (status === 'void') return 'Void';
  return 'Issued';
}

async function downloadInvoicePdf(invoice, bookingId) {
  const url =
    invoice.download_url ||
    jobsAPI.bookingInvoiceDownloadUrl(bookingId || invoice.booking_id);
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Could not download invoice');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `${invoice.number || 'invoice'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
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

function InvoiceBreakdown({ invoice, providerName }) {
  const currency = invoice.currency || 'CAD';
  const taxLines = Array.isArray(invoice.tax_lines) ? invoice.tax_lines : [];
  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const subtotal =
    invoice.subtotal != null ? invoice.subtotal : invoice.amount;
  const extrasTotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );
  const serviceFee = Math.max(0, (Number(subtotal) || 0) - extrasTotal);
  const discount = invoice.discount != null ? invoice.discount : 0;
  const provider =
    providerName || invoice.provider_name || invoice.organization_name || 'Provider';

  return (
    <div className="space-y-4 text-sm text-slate-800">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Provider</p>
        <p className="mt-0.5 text-base font-semibold text-slate-900">{provider}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice</p>
          <p className="mt-0.5 font-medium">{invoice.number}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
          <p className="mt-0.5 font-medium">{statusLabel(invoice.status)}</p>
        </div>
        {invoice.booking_reference && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Booking</p>
            <p className="mt-0.5 font-mono text-xs">{invoice.booking_reference}</p>
          </div>
        )}
        {(invoice.customer_name || invoice.customer_email) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</p>
            <p className="mt-0.5 font-medium">{invoice.customer_name || invoice.customer_email}</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bill</p>
        <dl className="mt-3 space-y-2">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-700">
              <span className="font-medium text-slate-900">
                {invoice.service_name || invoice.description || 'Service'}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">Service fee</span>
            </dt>
            <dd className="shrink-0 font-medium">{formatMoney(serviceFee, currency)}</dd>
          </div>
          {lineItems.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="flex justify-between gap-3">
              <dt className="min-w-0 text-slate-700">
                <span className="font-medium text-slate-900">{item.name || 'Item'}</span>
                {lineItemDetail(item) ? (
                  <span className="mt-0.5 block text-xs text-slate-500">{lineItemDetail(item)}</span>
                ) : null}
              </dt>
              <dd className="shrink-0 font-medium">{formatMoney(item.amount, currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="font-medium">{formatMoney(subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Discount</dt>
            <dd className="font-medium">{formatMoney(discount, currency)}</dd>
          </div>
          {taxLines.length > 0
            ? taxLines.map((line, idx) => {
                const code = (line.code || '').trim() || (line.name || 'Tax').split('(')[0].trim();
                const ratePct =
                  line.rate != null
                    ? ` (${(Number(line.rate) * 100) % 1 === 0 ? Number(line.rate) * 100 : (Number(line.rate) * 100).toFixed(2)}%)`
                    : '';
                return (
                  <div key={`${line.code || line.name}-${idx}`} className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      {code}
                      {ratePct}
                    </dt>
                    <dd className="shrink-0 font-medium">{formatMoney(line.amount, currency)}</dd>
                  </div>
                );
              })
            : invoice.tax_total != null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Tax</dt>
                  <dd className="shrink-0 font-medium">{formatMoney(invoice.tax_total, currency)}</dd>
                </div>
              )}
          <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base">
            <dt className="font-semibold text-slate-900">Total</dt>
            <dd className="font-bold text-slate-900">{formatMoney(invoice.amount, currency)}</dd>
          </div>
        </dl>
      </div>

      {invoice.notes ? (
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Notes: </span>
          {invoice.notes}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Invoice card with in-app view (no download required) + optional PDF download.
 * Use compact on list rows. Use showBreakdown to expand the bill inline (customers).
 */
export default function InvoicePanel({
  invoice,
  bookingId,
  providerName,
  compact = false,
  showBreakdown = false,
  className = '',
}) {
  const [viewOpen, setViewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!viewOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setViewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewOpen]);

  if (!invoice?.id && !invoice?.number) return null;

  const currency = invoice.currency || 'CAD';
  const amountLabel = formatMoney(invoice.amount, currency);

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadInvoicePdf(invoice, bookingId);
    } catch {
      setError('Download failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className={`rounded-xl border border-teal-100 bg-teal-50/40 ${
          compact && !showBreakdown ? 'px-3 py-3' : 'px-4 py-4'
        } ${className}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800/70">Invoice</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {invoice.number} · {amountLabel}
            </p>
            <p className="text-xs text-slate-600">
              {statusLabel(invoice.status)}
              {(providerName || invoice.provider_name) &&
                ` · ${providerName || invoice.provider_name}`}
            </p>
            {!compact && !showBreakdown && (
              <p className="mt-1 text-xs text-slate-500">
                Fee {formatMoney(invoice.subtotal != null ? invoice.subtotal : invoice.amount, currency)}
                {Number(invoice.tax_total) > 0
                  ? ` · Tax ${formatMoney(invoice.tax_total, currency)}`
                  : ''}
                {` · Total ${amountLabel}`}
              </p>
            )}
          </div>
          {!showBreakdown && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setViewOpen(true)}
                className="inline-flex min-h-[40px] items-center rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
              >
                View invoice
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleDownload}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                {busy ? 'Downloading…' : 'PDF'}
              </button>
            </div>
          )}
        </div>

        {showBreakdown && (
          <div className="mt-4 border-t border-teal-100/80 pt-4">
            <InvoiceBreakdown invoice={invoice} providerName={providerName} />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleDownload}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                {busy ? 'Downloading…' : 'Download PDF'}
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      {viewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-view-title"
          onClick={() => setViewOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="invoice-view-title" className="text-lg font-bold text-slate-900">
                Invoice
              </h2>
              <button
                type="button"
                onClick={() => setViewOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="mt-4">
              <InvoiceBreakdown invoice={invoice} providerName={providerName} />
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleDownload}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                {busy ? 'Downloading…' : 'Download PDF'}
              </button>
              <button
                type="button"
                onClick={() => setViewOpen(false)}
                className="min-h-[44px] flex-1 rounded-xl bg-teal-700 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
