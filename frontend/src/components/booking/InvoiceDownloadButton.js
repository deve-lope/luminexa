import React from 'react';
import { storage } from '../../utils/helpers';
import { jobsAPI } from '../../utils/api';

const currencyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CAD' });

async function downloadInvoicePdf(invoice) {
  const url = invoice.download_url || jobsAPI.bookingInvoiceDownloadUrl(invoice.bookingId);
  const token = storage.get('token');
  const res = await fetch(url, {
    headers: token ? { Authorization: `Token ${token}` } : {},
  });
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

  const amountLabel = currencyFmt.format(Number(invoice.amount || 0));
  const statusLabel =
    invoice.status === 'paid' ? 'Paid' : invoice.status === 'void' ? 'Void' : 'Issued';

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
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Invoice</p>
          <p className="text-sm font-semibold text-slate-900">
            {invoice.number} · {amountLabel}
          </p>
          <p className="text-xs text-slate-500">{statusLabel}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleDownload}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-luminexa-accent shadow-sm ring-1 ring-slate-200 hover:bg-violet-50 disabled:opacity-60"
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
