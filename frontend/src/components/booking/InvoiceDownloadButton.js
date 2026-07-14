import React from 'react';
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

async function downloadInvoicePdf(invoice) {
  const url = invoice.download_url || jobsAPI.bookingInvoiceDownloadUrl(invoice.bookingId);
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

/**
 * Shared invoice summary + PDF download for customer and provider views.
 */
export default function InvoiceDownloadButton({ invoice, bookingId, className = '' }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  if (!invoice?.id && !invoice?.number) return null;

  const currency = invoice.currency || 'CAD';
  const amountLabel = formatMoney(invoice.amount, currency);
  const statusLabel =
    invoice.status === 'paid' ? 'Paid' : invoice.status === 'void' ? 'Void' : 'Issued';
  const taxLines = Array.isArray(invoice.tax_lines) ? invoice.tax_lines : [];

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadInvoicePdf({
        ...invoice,
        bookingId: bookingId || invoice.booking_id,
        download_url:
          invoice.download_url ||
          (bookingId ? jobsAPI.bookingInvoiceDownloadUrl(bookingId) : null),
      });
    } catch {
      setError('Download failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Invoice</p>
          <p className="text-sm font-semibold text-slate-900">
            {invoice.number} · {amountLabel}
          </p>
          <p className="text-xs text-slate-500">{statusLabel}</p>
          {invoice.subtotal != null && (
            <p className="mt-1 text-xs text-slate-500">
              Subtotal {formatMoney(invoice.subtotal, currency)}
              {taxLines.length > 0
                ? ` · ${taxLines.map((t) => t.name || t.code).join(' + ')} ${formatMoney(invoice.tax_total, currency)}`
                : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleDownload}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-luminexa-accent shadow-sm ring-1 ring-slate-200 hover:bg-teal-50 disabled:opacity-60"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          {busy ? 'Downloading…' : 'Download PDF'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
