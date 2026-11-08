import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BookingServiceLocationSection from '../components/customer/BookingServiceLocationSection';
import { validateServiceLocationValue } from '../components/customer/ServiceLocationInput';
import { useAuth } from '../contexts/AuthContext';
import { jobsAPI } from '../utils/api';
import { formatTimeRange } from '../utils/datetime';
import { bookingStatusLabel } from '../utils/customerBookings';
import {
  getOpenInAppUrl,
  getStoreInstallOptions,
  isAndroidUserAgent,
  isIosUserAgent,
  probePlayAppInstalled,
} from '../utils/storeLinks';
import { isNativeApp } from '../native/capacitorNative';
import { customerBookingDetail } from '../utils/customerPaths';

function formatDuration(minutes, startIso, endIso) {
  let mins = Number(minutes) || 0;
  if (!mins && startIso && endIso) {
    mins = Math.round((new Date(endIso) - new Date(startIso)) / 60000);
  }
  if (!mins || mins < 1) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

function mapsSearchUrl(address) {
  const q = String(address || '').replace(/\s*\n+\s*/g, ', ').trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
}

function googleCalendarUrl({ title, startIso, endIso, location, details }) {
  if (!startIso) return '';
  const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = endIso || new Date(new Date(startIso).getTime() + 3600000).toISOString();
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(startIso)}/${fmt(end)}`,
    details: details || '',
    location: location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function Icon({ d, className = 'h-5 w-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  pin: 'M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11zM12 12a2 2 0 100-4 2 2 0 000 4z',
  hash: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14',
};

function DetailRow({ icon, label, children }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-luminexa-accent">
        <Icon d={icon} className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="mt-0.5 text-sm text-slate-900">{children}</div>
      </div>
    </div>
  );
}

export default function GuestBookingPage() {
  const { token } = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
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
  const isMobileDevice = isAndroidUserAgent(ua) || isIosUserAgent(ua);
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
      .then((res) => {
        setData(res.data);
        const saved = (res.data?.saved_service_address || '').trim();
        if (saved) setJobAddress(saved);
      })
      .catch(() => {
        setData(null);
        setError('This booking link is invalid or expired.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (native || !isMobileDevice) return undefined;
    let cancelled = false;
    probePlayAppInstalled().then((installed) => {
      if (!cancelled) setAppInstalled(installed);
    });
    return () => {
      cancelled = true;
    };
  }, [native, isMobileDevice]);

  // App prompts only make sense on a phone/tablet — never on a laptop/desktop browser.
  const showAppBanner = Boolean(data) && !native && isMobileDevice;
  const showOpenInApp =
    showAppBanner &&
    Boolean(openInAppUrl) &&
    (appInstalled === true || (appInstalled === null && isAndroidUserAgent(ua)));
  const showInstall = showAppBanner && (appInstalled === false || (appInstalled === null && !showOpenInApp));

  const needsConfirm = Boolean(data?.needs_customer_confirm);
  const needsAddress = Boolean(data?.needs_job_address);
  const savedAddressUser = useMemo(
    () => ({
      default_service_address: (data?.saved_service_address || '').trim(),
    }),
    [data?.saved_service_address],
  );
  const addressCheck = needsAddress
    ? validateServiceLocationValue(jobAddress)
    : { valid: true, error: null };

  const confirmBooking = async (e) => {
    e.preventDefault();
    if (!token || confirming) return;
    if (needsAddress) {
      if (!addressCheck.valid) {
        setConfirmError(addressCheck.error || 'Enter a complete job address.');
        return;
      }
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

  const start = data?.start_at ? new Date(data.start_at) : null;
  const isShop = data?.fulfillment_kind === 'shop';
  const location = (data?.job_location || '').trim();
  const mapsUrl = mapsSearchUrl(location);
  const duration = data ? formatDuration(data.service_duration_minutes, data.start_at, data.end_at) : '';
  const confirmed = data && !needsConfirm && ['confirmed', 'in_progress', 'completed'].includes(data.status);
  const calendarUrl =
    data && confirmed
      ? googleCalendarUrl({
          title: `${data.service_name} — ${data.organization_name}`,
          startIso: data.start_at,
          endIso: data.end_at,
          location,
          details: `Booking ${data.reference || ''} with ${data.organization_name} (Luminexa)`,
        })
      : '';
  const statusText = data
    ? needsConfirm
      ? 'Confirm to lock it in'
      : bookingStatusLabel(data.status, {
          awaitingCustomerAcceptance: data.awaiting_customer_acceptance,
        })
    : '';
  const statusTone = needsConfirm
    ? 'bg-amber-100 text-amber-900 ring-amber-200'
    : confirmed
      ? 'bg-emerald-100 text-emerald-900 ring-emerald-200'
      : 'bg-slate-100 text-slate-700 ring-slate-200';
  const providerInitial = (data?.organization_name || 'L').trim().charAt(0).toUpperCase();
  const providerHref =
    data?.organization_slug && data.organization_profile_public !== false
      ? `/book/${data.organization_slug}`
      : '';

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-teal-50/70 via-luminexa-canvas to-luminexa-canvas text-slate-900">
      <header className="border-b border-teal-900/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-slate-900">
            Luminexa
          </Link>
          {data?.reference && (
            <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-600">
              {data.reference}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-16 sm:px-6 sm:py-10">
        {loading && <p className="py-16 text-center text-slate-500">Loading booking…</p>}
        {error && !data && (
          <p className="mx-auto max-w-lg rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {showAppBanner && (
          <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-teal-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Better in the Luminexa app</p>
              <p className="mt-0.5 text-sm text-slate-600">
                {showOpenInApp
                  ? 'Open this appointment in the app for live updates and messages.'
                  : 'Get reminders, messages and live updates for this appointment.'}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {showOpenInApp && (
                <a href={openInAppUrl} className="lx-btn-primary min-h-[40px] px-5">
                  Open in app
                </a>
              )}
              {showInstall &&
                stores.map((store) => (
                  <a
                    key={store.id}
                    href={store.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[40px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800"
                  >
                    {store.label}
                  </a>
                ))}
            </div>
          </section>
        )}

        {data && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
            {/* Appointment details */}
            <section className="overflow-hidden rounded-3xl bg-white shadow-lx-card ring-1 ring-slate-100">
              <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600 px-5 py-5 text-white sm:px-7 sm:py-6">
                <div className="flex items-center gap-3">
                  {data.organization_logo_url ? (
                    <img
                      src={data.organization_logo_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-2xl bg-white object-cover ring-2 ring-white/40"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-xl font-bold ring-2 ring-white/30">
                      {providerInitial}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white/90">{data.organization_name}</p>
                    {(data.organization_tagline || data.organization_location) && (
                      <p className="truncate text-xs text-white/75">
                        {data.organization_tagline || data.organization_location}
                      </p>
                    )}
                  </div>
                </div>
                <h1 className="mt-5 text-2xl font-bold leading-tight sm:text-3xl">{data.service_name}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone}`}
                  >
                    {statusText}
                  </span>
                  {data.customer_first_name && (
                    <span className="text-sm text-white/85">for {data.customer_first_name}</span>
                  )}
                </div>
              </div>

              <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
                <div className="flex items-stretch gap-4">
                  {start && (
                    <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-teal-50 py-3 text-center ring-1 ring-teal-100">
                      <span className="text-xs font-bold uppercase tracking-wide text-luminexa-accent">
                        {start.toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                      <span className="text-3xl font-extrabold leading-none text-slate-900">
                        {start.getDate()}
                      </span>
                      <span className="mt-1 text-xs font-medium text-slate-500">
                        {start.toLocaleDateString(undefined, { weekday: 'short' })}
                      </span>
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <p className="text-lg font-semibold text-slate-900">
                      {start
                        ? start.toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : ''}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {formatTimeRange(data.start_at, data.end_at)}
                      {duration ? ` · ${duration}` : ''}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 border-t border-slate-100 pt-5">
                  <DetailRow icon={ICONS.pin} label={isShop ? 'Where to go' : 'Service address'}>
                    {location ? (
                      <>
                        <p className="whitespace-pre-line font-medium">{location}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {isShop ? 'Come to the shop at this address.' : 'The provider comes to you.'}
                        </p>
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex min-h-[36px] items-center rounded-full border border-slate-200 px-3 text-xs font-semibold text-luminexa-accent hover:bg-teal-50"
                          >
                            Open in Maps
                          </a>
                        )}
                      </>
                    ) : needsAddress ? (
                      <p className="text-slate-600">Add your address below so the provider knows where to go.</p>
                    ) : (
                      <p className="text-slate-600">Address will be shared by your provider.</p>
                    )}
                  </DetailRow>

                  {data.reference && (
                    <DetailRow icon={ICONS.hash} label="Booking reference">
                      <p className="font-mono font-medium">{data.reference}</p>
                    </DetailRow>
                  )}
                </div>

                {providerHref && (
                  <div className="border-t border-slate-100 pt-4">
                    <Link
                      to={providerHref}
                      className="text-sm font-semibold text-luminexa-accent hover:underline"
                    >
                      View {data.organization_name} profile &rarr;
                    </Link>
                  </div>
                )}
              </div>
            </section>

            {/* Action panel */}
            <aside className="space-y-4 lg:sticky lg:top-6">
              <section className="rounded-3xl bg-white p-5 shadow-lx-card ring-1 ring-slate-100 sm:p-6">
                {needsConfirm ? (
                  <form onSubmit={confirmBooking} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Confirm your appointment</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {needsAddress
                          ? data.saved_service_address
                            ? 'Check your job address (or change it), then lock in this appointment.'
                            : 'Add the job address and confirm so this appointment is locked in.'
                          : 'Confirm so this appointment is locked in on Luminexa.'}
                      </p>
                    </div>
                    {needsAddress && (
                      <BookingServiceLocationSection
                        user={savedAddressUser}
                        value={jobAddress}
                        onChange={setJobAddress}
                        label="Job address"
                        hint="Street, city, province/state, and postal / ZIP code are required."
                      />
                    )}
                    {confirmError && (
                      <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{confirmError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={confirming || (needsAddress && !addressCheck.valid)}
                      className="lx-btn-primary flex w-full min-h-[48px] items-center justify-center disabled:opacity-50"
                    >
                      {confirming ? 'Confirming…' : 'Confirm booking'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                      <p className="text-sm font-semibold text-emerald-900">
                        {confirmed ? 'You’re all set' : statusText}
                      </p>
                      <p className="mt-0.5 text-sm text-emerald-800">
                        {isAuthenticated || native
                          ? 'This booking is on your Upcoming list.'
                          : 'Log in to see it under Upcoming on Home.'}
                      </p>
                    </div>
                    {!authLoading && isAuthenticated ? (
                      <>
                        <Link
                          to={customerBookingDetail(data.id)}
                          className="lx-btn-primary flex min-h-[48px] items-center justify-center"
                        >
                          View this booking
                        </Link>
                        <Link
                          to="/customer"
                          className="flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 text-sm font-medium text-slate-800"
                        >
                          Go to Home
                        </Link>
                      </>
                    ) : !authLoading ? (
                      <>
                        <Link
                          to={`/login?next=${encodeURIComponent(customerBookingDetail(data.id))}`}
                          className="lx-btn-primary flex min-h-[48px] items-center justify-center"
                        >
                          Log in to Luminexa
                        </Link>
                        <p className="text-center text-xs text-slate-500">
                          Use the email this booking was sent to — we’ll send a one-time code.
                        </p>
                      </>
                    ) : null}
                  </div>
                )}

                {calendarUrl && (
                  <a
                    href={calendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    Add to Google Calendar
                  </a>
                )}
              </section>

              {!native && !isMobileDevice && (
                <p className="px-2 text-center text-xs text-slate-500">
                  Get the Luminexa app for reminders and messages:{' '}
                  {stores.map((store, i) => (
                    <React.Fragment key={store.id}>
                      {i > 0 && ' · '}
                      <a
                        href={store.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-luminexa-accent hover:underline"
                      >
                        {store.id === 'play' ? 'Google Play' : 'App Store'}
                      </a>
                    </React.Fragment>
                  ))}
                </p>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
