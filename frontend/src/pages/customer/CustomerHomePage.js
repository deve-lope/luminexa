import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BusinessTypeTileGrid from '../../components/customer/BusinessTypeTileGrid';
import ScheduledProviderCard from '../../components/customer/ScheduledProviderCard';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { businessesAPI, jobsAPI } from '../../utils/api';
import { bookingStatusLabel } from '../../utils/customerBookings';
import { formatWhen } from '../../utils/datetime';
import { customerBookingDetail, customerBookings, customerCategories, customerFind, customerGigs, customerNotifications } from '../../utils/customerPaths';
import {
  NOTIFICATIONS_CHANGED_EVENT,
  dismissAllNotifications,
  dismissNotificationQuietly,
  emitNotificationsChanged,
  notificationDestination,
} from '../../utils/customerNotifications';
import { lxPillTone } from '../../utils/pillGradients';
import useUnpaidInvoice, { markInvoiceBookingPaid } from '../../hooks/useUnpaidInvoice';
import InvoiceStripePayModal from '../../components/booking/InvoiceStripePayModal';
import { IconMapPin, IconSchedule } from '../../components/icons/NavIcons';

const MAX_HOME_PROVIDERS = 3;
const MAX_HOME_CATEGORIES = 8;

function ProvidersSection({ providers }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = providers.length > MAX_HOME_PROVIDERS;
  const visible = expanded ? providers : providers.slice(0, MAX_HOME_PROVIDERS);
  const toneCount = Math.max(visible.length, 1);

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className="lx-eyebrow">Network</p>
          <h2 className="lx-section-title mt-1">Your providers</h2>
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="lx-link"
          >
            {expanded ? 'Show less' : `See all (${providers.length})`}
          </button>
        )}
      </div>
      <ul
        className={`grid gap-3 ${
          visible.length === 1
            ? 'grid-cols-1'
            : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {visible.map((p, i) => (
          <li key={p.organization_slug} className="min-w-0">
            <ScheduledProviderCard
              provider={p}
              compact={hasMore && !expanded}
              toneIndex={i}
              toneCount={toneCount}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function bookingStatusClass(status, tone) {
  if (status === 'requested') return tone.statusWarn;
  if (status === 'confirmed') return tone.statusOk;
  return tone.statusNeutral;
}

function initials(name) {
  const parts = (name || 'U').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0][0] || 'U').toUpperCase();
}

export default function CustomerHomePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [home, setHome] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const {
    payment: unpaidPayment,
    clear: clearUnpaid,
  } = useUnpaidInvoice({ pollMs: 30000 });
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = useCallback(() => {
    jobsAPI
      .listMyNotifications()
      .then((res) => setNotifications(res.data?.results || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    businessesAPI
      .getCustomerHome()
      .then((res) => {
        if (!cancelled) setHome(res.data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your dashboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadNotifications();
    const onChanged = () => loadNotifications();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
  }, [loadNotifications]);

  const dismissNotification = async (id) => {
    try {
      await jobsAPI.dismissMyNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      emitNotificationsChanged();
    } catch {
      showToast('Could not dismiss notification.', 'error');
    }
  };

  const openNotification = async (n) => {
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    await dismissNotificationQuietly(n.id);
    navigate(notificationDestination(n));
  };

  const markAllRead = async () => {
    if (notifications.length === 0) return;
    try {
      await dismissAllNotifications();
      setNotifications([]);
      showToast('All updates marked as read.', 'success');
    } catch {
      showToast('Could not mark updates as read.', 'error');
    }
  };

  const popularTypes = useMemo(
    () => (home?.business_types || []).slice(0, MAX_HOME_CATEGORIES),
    [home?.business_types],
  );

  const firstName = (user?.full_name || '').split(' ')[0] || 'there';

  if (loading) {
    return (
      <div className="space-y-5 pb-4" aria-busy="true" aria-label="Loading your dashboard">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
        <div>
          <Skeleton className="mb-3 h-5 w-40" />
          <SkeletonList count={2} />
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  const providers = home?.providers || [];
  const upcoming = home?.upcoming_bookings || [];
  const homeNotifications = notifications.slice(0, 2);
  const extraNotificationCount = Math.max(0, notifications.length - 2);
  const unpaidInvoice = unpaidPayment?.invoice;
  const unpaidAmountLabel = (() => {
    if (!unpaidInvoice) return '';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: unpaidInvoice.currency || 'CAD',
      }).format(Number(unpaidInvoice.amount) || 0);
    } catch {
      return `$${Number(unpaidInvoice.amount || 0).toFixed(2)}`;
    }
  })();

  return (
    <div className="space-y-6 pb-4 lg:space-y-8">
      {unpaidInvoice && (
        <section
          className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm ring-1 ring-amber-100"
          aria-label="Unpaid invoice"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800">
                Payment due
              </p>
              <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900">
                {unpaidAmountLabel}
              </p>
              <p className="truncate text-sm text-slate-600">
                {unpaidPayment.organization_name}
                {unpaidPayment.service_name ? ` · ${unpaidPayment.service_name}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                window.sessionStorage.setItem(
                  'luminexa.pendingInvoiceBookingId',
                  String(unpaidPayment.booking_id)
                );
                setPayOpen(true);
              }}
              className="lx-btn-primary min-h-[48px] shrink-0 px-5"
            >
              Pay now
            </button>
          </div>
        </section>
      )}

      {homeNotifications.length > 0 && (
        <section className="space-y-2" aria-label="Updates">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="lx-eyebrow">Updates</p>
              <h2 className="lx-section-title mt-1">From your providers</h2>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={markAllRead}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Mark all read
              </button>
              <Link to={customerNotifications()} className="lx-link">
                {extraNotificationCount > 0
                  ? `See all (${notifications.length})`
                  : 'See all'}
              </Link>
            </div>
          </div>
          <ul className="space-y-2">
            {homeNotifications.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-3 rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                  <p className="mt-0.5 text-sm text-slate-700">{n.message}</p>
                  <span className="mt-2 inline-flex text-sm font-medium text-luminexa-accent">
                    View details →
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => dismissNotification(n.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800"
                  aria-label="Dismiss"
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
          {extraNotificationCount > 0 && (
            <Link
              to={customerNotifications()}
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800"
            >
              Show all updates ({notifications.length})
            </Link>
          )}
        </section>
      )}

      <header className="lx-hero">
        <div className="relative flex flex-col justify-between p-5 sm:p-6 lg:flex-row lg:items-end lg:gap-8 lg:p-7">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold tracking-tight ring-1 ring-white/20 backdrop-blur-sm lg:h-14 lg:w-14 lg:text-xl">
              {initials(user?.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-teal-100/90">
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight lg:text-3xl">
                Hi, {firstName}
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/80 lg:text-[15px]">
                Search once, compare nearby providers, and book the service you need.
              </p>
            </div>
          </div>
          <Link
            to={customerFind()}
            className="lx-btn-ghost mt-5 w-full border-transparent bg-white text-teal-900 hover:bg-teal-50 sm:w-auto lg:mt-0"
          >
            Browse services
          </Link>
        </div>
      </header>

      <section className="lx-section-band">
        <div className="mb-4 flex items-end justify-between gap-2">
          <div>
            <p className="lx-eyebrow">Browse</p>
            <h2 className="lx-section-title mt-1">Popular categories</h2>
          </div>
          <Link to={customerCategories()} className="lx-link shrink-0">
            See all
          </Link>
        </div>
        {popularTypes.length === 0 ? (
          <div className="lx-empty">
            <p className="text-sm font-medium text-slate-800">Ready for your first booking?</p>
            <p className="lx-muted mt-1">
              Browse providers on Book, or pick a category when they appear here.
            </p>
            <Link to={customerFind()} className="lx-btn-primary mt-4 inline-flex">
              Explore providers
            </Link>
          </div>
        ) : (
          <BusinessTypeTileGrid types={popularTypes} />
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="lx-eyebrow">Schedule</p>
              <h2 className="lx-section-title mt-1">Up next</h2>
            </div>
            <Link to={customerBookings()} className="lx-link">
              All
            </Link>
          </div>
          <ul
            className={`grid gap-3 ${
              upcoming.length === 1
                ? 'grid-cols-1 sm:max-w-md'
                : upcoming.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            {upcoming.map((b, i) => {
              const tone = lxPillTone(i, upcoming.length);
              return (
                <li key={b.id} className="min-w-0">
                  <Link
                    to={customerBookingDetail(b.id)}
                    className={`flex min-h-[148px] flex-col justify-between rounded-3xl p-4 shadow-lx-soft ring-1 transition hover:-translate-y-0.5 hover:shadow-lx-elevated ${tone.surface} ${tone.ring}`}
                  >
                    <div>
                      <p className={`font-semibold tracking-tight ${tone.title}`}>{b.service_name}</p>
                      <p className={`mt-0.5 text-sm ${tone.body}`}>{b.organization_name}</p>
                      {b.quote_amount != null && (
                        <p className={`mt-1 text-sm font-medium tabular-nums ${tone.title}`}>
                          Agreed · ${Number(b.quote_amount).toFixed(2)}
                        </p>
                      )}
                      <p className={`mt-3 flex items-start gap-2 text-sm font-medium ${tone.title}`}>
                        <IconSchedule
                          className={`mt-0.5 h-4 w-4 shrink-0 ${tone.body}`}
                          aria-hidden
                        />
                        <span>
                          <span className="sr-only">When: </span>
                          {formatWhen(b.start_at)}
                        </span>
                      </p>
                      {(b.job_location || b.service_address) && (
                        <p className={`mt-1.5 flex items-start gap-2 text-sm ${tone.body}`}>
                          <IconMapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span className="line-clamp-2">
                            <span className="sr-only">Place: </span>
                            {b.job_location || b.service_address}
                          </span>
                        </p>
                      )}
                      <span
                        className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs capitalize ${bookingStatusClass(b.status, tone)}`}
                      >
                        {bookingStatusLabel(b.status, {
                          bookingPolicy: b.booking_policy,
                          servicePricingType: b.service_pricing_type,
                          awaitingCustomerAcceptance: b.awaiting_customer_acceptance,
                        })}
                      </span>
                    </div>
                    <span className={`mt-3 text-sm font-medium ${tone.link}`}>
                      View details →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {providers.length > 0 && <ProvidersSection providers={providers} />}
      <Link
        to={customerGigs()}
        className="lx-card-interactive flex items-center justify-between gap-3 p-4"
      >
        <div className="min-w-0">
          <p className="lx-eyebrow">Gig wall</p>
          <p className="mt-1 font-semibold text-slate-900">Post a job for local providers</p>
          <p className="lx-muted mt-0.5 text-sm">
            Describe what you need. Nearby businesses can quote.
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-teal-700">Open →</span>
      </Link>

      {unpaidInvoice && (
        <InvoiceStripePayModal
          open={payOpen}
          bookingId={unpaidPayment.booking_id}
          invoice={unpaidInvoice}
          organizationName={unpaidPayment.organization_name}
          serviceName={unpaidPayment.service_name}
          onClose={() => setPayOpen(false)}
          onPaid={() => {
            setPayOpen(false);
            markInvoiceBookingPaid(unpaidPayment.booking_id);
            clearUnpaid();
            showToast?.('Payment received.');
          }}
        />
      )}
    </div>
  );
}
