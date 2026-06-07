import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerBookingCard from '../../components/customer/CustomerBookingCard';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import { isHistoryBooking } from '../../utils/customerBookings';
import { customerFind } from '../../utils/customerPaths';

function inquiryStatusLabel(inquiry) {
  return inquiry.dismissed_at ? 'Handled by business' : 'Sent — awaiting response';
}

function inquiryStatusClass(inquiry) {
  return inquiry.dismissed_at
    ? 'bg-slate-100 text-slate-600'
    : 'bg-amber-100 text-amber-800';
}

export default function CustomerHistoryPage() {
  const [bookings, setBookings] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    Promise.all([jobsAPI.listBookings(), jobsAPI.listMyServiceInquiries()])
      .then(([bookingsRes, inquiriesRes]) => {
        const list = Array.isArray(bookingsRes.data)
          ? bookingsRes.data
          : bookingsRes.data?.results || [];
        setBookings(list);
        setInquiries(Array.isArray(inquiriesRes.data) ? inquiriesRes.data : []);
        setError(null);
      })
      .catch(() => setError('Could not load your history.'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const historyBookings = useMemo(
    () => bookings.filter(isHistoryBooking),
    [bookings]
  );

  const hasActivity = historyBookings.length > 0 || inquiries.length > 0;

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!hasActivity && !error && (
        <div className="rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-slate-600">No past activity yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Completed bookings, cancelled requests, and custom service messages will appear here.
          </p>
          <Link
            to={customerFind()}
            className="mt-4 inline-flex min-h-[48px] items-center rounded-xl bg-luminexa-accent px-6 font-medium text-white"
          >
            Find a service
          </Link>
        </div>
      )}

      {historyBookings.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Past bookings</h2>
          <ul className="space-y-3">
            {historyBookings.map((b) => (
              <CustomerBookingCard
                key={b.id}
                booking={b}
                expanded={expandedId === b.id}
                onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
              />
            ))}
          </ul>
        </section>
      )}

      {inquiries.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Service requests</h2>
          <ul className="space-y-3">
            {inquiries.map((inq) => (
              <li key={inq.id} className="rounded-xl bg-white p-4 shadow-sm">
                <p className="font-semibold text-slate-900">
                  {inq.service_name || inq.service_label || 'Custom service request'}
                </p>
                <p className="text-sm text-slate-600">{inq.organization_name}</p>
                <p className="mt-1 text-sm text-slate-500">{formatWhen(inq.created_at)}</p>
                {inq.preferred_date && (
                  <p className="mt-1 text-xs text-slate-500">Preferred date: {inq.preferred_date}</p>
                )}
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${inquiryStatusClass(inq)}`}
                >
                  {inquiryStatusLabel(inq)}
                </span>
                <p className="mt-2 text-sm text-slate-700 line-clamp-3">{inq.message}</p>
                {inq.organization_slug && (
                  <Link
                    to={`/book/${inq.organization_slug}`}
                    className="mt-4 inline-flex min-h-[44px] items-center text-sm font-medium text-luminexa-accent"
                  >
                    View provider →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
