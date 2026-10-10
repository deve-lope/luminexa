import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { jobsAPI } from '../utils/api';
import { formatWhen } from '../utils/datetime';
import { bookingStatusLabel } from '../utils/customerBookings';
import {
  getOpenInAppUrl,
  getStoreInstallOptions,
  isAndroidUserAgent,
  probePlayAppInstalled,
} from '../utils/storeLinks';
import { isNativeApp } from '../native/capacitorNative';
import { customerBookingDetail } from '../utils/customerPaths';

export default function GuestBookingPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobAddress, setJobAddress] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  /** true = Play app installed; false = not; null = unknown / unsupported. */
  const [appInstalled, setAppInstalled] = useState(null);
  const native = isNativeApp();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const stores = useMemo(() => getStoreInstallOptions(ua), [ua]);
  const openInAppUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return getOpenInAppUrl(window.location.href, ua);
  }, [ua]);

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

  useEffect(() => {
    if (native) return undefined;
    let cancelled = false;
    probePlayAppInstalled().then((installed) => {
      if (!cancelled) setAppInstalled(installed);
    });
    return () => {
      cancelled = true;
    };
  }, [native]);

  const showOpenInApp =
    Boolean(openInAppUrl) &&
    (appInstalled === true || (appInstalled === null && isAndroidUserAgent(ua)));
  const showInstall =
    appInstalled === false || (appInstalled === null && !showOpenInApp);

  const needsConfirm = Boolean(data?.needs_customer_confirm);
  const needsAddress = Boolean(data?.needs_job_address);

  const confirmBooking = async (e) => {
    e.preventDefault();
    if (!token || confirming) return;
    if (needsAddress && !jobAddress.trim()) {
      setConfirmError('Enter the address where the provider should come.');
      return;
    }
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await jobsAPI.confirmPublicBooking(token, {
        service_address: needsAddress ? jobAddress.trim() : '',
      });
      setData(res.data);
      setJobAddress('');
    } catch (err) {
      const d = err.response?.data;
      const msg =
        d?.service_address?.[0] ||
        d?.status?.[0] ||
        d?.detail ||
        'Could not confirm this booking. Try again.';
      setConfirmError(String(msg));
    } finally {
      setConfirming(false);
    }
  };

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
              {showOpenInApp
                ? 'Open this appointment in the Luminexa app, or keep viewing it here on the web.'
                : 'You can see the appointment here on the web, or install the latest Luminexa app.'}
            </p>
            {showOpenInApp && (
              <a
                href={openInAppUrl}
                className="lx-btn-primary mt-4 flex min-h-[44px] items-center justify-center"
              >
                Open in app
              </a>
            )}
            <a
              href="#booking"
              className={`${
                showOpenInApp
                  ? 'mt-3 flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 text-sm font-medium text-slate-800'
                  : 'lx-btn-primary mt-4 flex min-h-[44px] items-center justify-center'
              }`}
            >
              View booking on the web
            </a>
            {showInstall && (
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
            )}
          </section>
        )}

        {data && (
          <section id="booking" className="scroll-mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {data.organization_name}
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{data.service_name}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {needsConfirm
                ? 'Reserved — confirm to finish'
                : bookingStatusLabel(data.status, {
                    awaitingCustomerAcceptance: data.awaiting_customer_acceptance,
                  })}
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

            {needsConfirm ? (
              <form onSubmit={confirmBooking} className="mt-6 space-y-3">
                <p className="text-sm text-slate-700">
                  {needsAddress
                    ? 'Add the job address and confirm so this appointment is locked in.'
                    : 'Confirm this appointment so it is locked in on Luminexa.'}
                </p>
                {needsAddress && (
                  <label className="block text-sm font-medium text-slate-700">
                    Job address
                    <input
                      type="text"
                      value={jobAddress}
                      onChange={(e) => setJobAddress(e.target.value)}
                      placeholder="Street, city, postal code"
                      autoComplete="street-address"
                      className="mt-1 block w-full min-h-[48px] rounded-xl border border-slate-200 px-3 text-base"
                    />
                  </label>
                )}
                {confirmError && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{confirmError}</p>
                )}
                <button
                  type="submit"
                  disabled={confirming || (needsAddress && !jobAddress.trim())}
                  className="lx-btn-primary flex w-full min-h-[48px] items-center justify-center disabled:opacity-50"
                >
                  {confirming ? 'Confirming…' : 'Confirm booking'}
                </button>
              </form>
            ) : (
              <div className="mt-6 space-y-2">
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-100">
                  Booking confirmed. Log in to see it under Upcoming on Home.
                </p>
                <Link
                  to={`/login?next=${encodeURIComponent('/customer')}`}
                  className="lx-btn-primary flex min-h-[44px] items-center justify-center"
                >
                  Log in to Luminexa
                </Link>
                <p className="text-center text-xs text-slate-500">
                  Use the email this booking was sent to — we’ll send a one-time code.
                </p>
                <Link
                  to={`/login?next=${encodeURIComponent(customerBookingDetail(data.id))}`}
                  className="flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 text-sm font-medium text-slate-800"
                >
                  Sign in to open this booking
                </Link>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
