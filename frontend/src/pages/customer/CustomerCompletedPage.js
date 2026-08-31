import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerBookingCard from '../../components/customer/CustomerBookingCard';
import BookingsSubNav from '../../components/customer/BookingsSubNav';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { jobsAPI } from '../../utils/api';
import { isCompletedBooking } from '../../utils/customerBookings';
import { customerBookingDetail, customerFind } from '../../utils/customerPaths';

function invoicePaymentLabel(invoice) {
  if (!invoice) return null;
  if (invoice.status === 'paid') return { text: 'Paid', className: 'bg-emerald-100 text-emerald-800' };
  if (invoice.status === 'issued') return { text: 'Payment due', className: 'bg-amber-100 text-amber-900' };
  if (invoice.status === 'void') return { text: 'Invoice voided', className: 'bg-slate-100 text-slate-600' };
  return null;
}

function formatInvoiceAmount(invoice) {
  if (!invoice || invoice.amount == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: invoice.currency || 'CAD',
    }).format(Number(invoice.amount) || 0);
  } catch {
    return `$${Number(invoice.amount || 0).toFixed(2)}`;
  }
}

export default function CustomerCompletedPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listBookings()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setBookings(list);
        setError(null);
      })
      .catch(() => setError('Could not load completed services.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completed = useMemo(() => {
    return bookings
      .filter(isCompletedBooking)
      .sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  }, [bookings]);

  return (
    <div className="space-y-4">
      <BookingsSubNav />
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading completed services">
          <Skeleton className="h-5 w-40" />
          <SkeletonList count={2} />
        </div>
      ) : completed.length === 0 ? (
        <div className="lx-empty">
          <p className="text-slate-600">No completed services yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Finished jobs and paid invoices will show up here after your appointment is done.
          </p>
          <Link
            to={customerFind()}
            className="lx-btn-primary mt-4 inline-flex min-h-[48px] items-center px-6"
          >
            Find a service
          </Link>
        </div>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Completed services</h2>
          <ul className="space-y-3">
            {completed.map((booking) => {
              const payment = invoicePaymentLabel(booking.invoice);
              const amount = formatInvoiceAmount(booking.invoice);
              return (
                <li key={booking.id} className="space-y-2">
                  <CustomerBookingCard
                    booking={booking}
                    compact
                    detailTo={customerBookingDetail(booking.id)}
                  />
                  {payment && (
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${payment.className}`}
                      >
                        {payment.text}
                      </span>
                      {amount && (
                        <span className="text-xs font-medium text-slate-600 tabular-nums">{amount}</span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
