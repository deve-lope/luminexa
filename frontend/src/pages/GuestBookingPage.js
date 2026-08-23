import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { jobsAPI } from '../utils/api';
import { formatWhen } from '../utils/datetime';
import { bookingStatusLabel } from '../utils/customerBookings';
import { getStoreInstallOptions } from '../utils/storeLinks';
import { isNativeApp } from '../native/capacitorNative';
import { customerBookingDetail } from '../utils/customerPaths';

export default function GuestBookingPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const native = isNativeApp();
  const stores = getStoreInstallOptions();

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    jobsAPI
      .getPublicBooking(token)
      .then((res) => setData(res.data))
      .catch(() => {
        setData(null);
        setError('This booking link is invalid or expired.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-[100dvh] bg-luminexa-canvas text-slate-900">
      <header className="border-b border-teal-900/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-slate-900">
            Luminexa
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-24">
        {loading && <p className="py-8 text-center text-slate-500">Loading booking…</p>}
        {error && !data && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {data && !native && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">You’re viewing this in your browser</p>
            <p className="mt-1 text-sm text-slate-600">
              You can see the appointment here on the web, or install the latest Luminexa app.
            </p>
            <a
              href="#booking"
              className="lx-btn-primary mt-4 flex min-h-[44px] items-center justify-center"
            >
              View booking on the web
            </a>
            <div className="mt-3 grid gap-2">
              {stores.map((store) => (
                <a
                  key={store.id}
                  href={store.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 text-sm font-medium text-slate-800"
                >
                  {store.label}
                </a>
              ))}
            </div>
          </section>
        )}

        {data && (
          <section id="booking" className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {data.organization_name}
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{data.service_name}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {bookingStatusLabel(data.status)}
              {data.customer_first_name ? ` · ${data.customer_first_name}` : ''}
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">When</dt>
                <dd className="mt-1 font-medium text-slate-900">{formatWhen(data.start_at)}</dd>
                {data.end_at && (
                  <dd className="text-slate-600">Until {formatWhen(data.end_at)}</dd>
                )}
              </div>
              {data.job_location && (
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">
                    {data.job_location_label || 'Location'}
                  </dt>
                  <dd className="mt-1 text-slate-900">{data.job_location}</dd>
                </div>
              )}
            </dl>
            <Link
              to={`/login?next=${encodeURIComponent(customerBookingDetail(data.id))}`}
              className="mt-6 inline-flex min-h-[40px] items-center text-sm font-medium text-luminexa-accent"
            >
              Sign in to cancel, reschedule, or pay
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
