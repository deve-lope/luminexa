import React, { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { useAuth } from '../../contexts/AuthContext';
import { subscriptionDaysRemaining } from '../../utils/providerSubscription';

function statusCopy(status) {
  if (status === 'trialing') return 'Free trial';
  if (status === 'active') return 'Active';
  if (status === 'past_due') return 'Past due';
  if (status === 'canceled') return 'Canceled';
  if (status === 'unpaid') return 'Unpaid';
  return 'Not subscribed';
}

function StatusPill({ tone = 'slate', children }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-900 ring-amber-200',
    red: 'bg-red-50 text-red-800 ring-red-200',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    teal: 'bg-teal-50 text-teal-800 ring-teal-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

function subTone(status, active) {
  if (status === 'past_due' || status === 'unpaid') return 'red';
  if (status === 'trialing') return 'amber';
  if (active || status === 'active') return 'green';
  return 'slate';
}

function connectTone(connect) {
  if (connect.can_accept_cards) return 'green';
  if (connect.details_submitted) return 'amber';
  return 'slate';
}

function connectLabel(connect) {
  if (connect.can_accept_cards) return 'Ready for cards';
  if (connect.details_submitted) return 'In review';
  return 'Not set up';
}

/**
 * Stripe Connect (customer card payouts) + provider Pro subscription.
 * Owner-only actions; staff can view status.
 */
export default function ProviderBillingSettings({ orgSlug, isOwner, returnPath }) {
  const { refreshSession } = useAuth();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const stripeReturnPath = returnPath || `/provider/${orgSlug}/billing`;
  const subscribeSuccessPath = returnPath || `/provider/${orgSlug}/subscribe`;

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await jobsAPI.getOrgBilling(orgSlug);
      setBilling(res.data);
    } catch (e) {
      setError(parseApiError(e) || 'Could not load billing.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const promoFromUrl = (params.get('promo') || '').trim();
    if (promoFromUrl) {
      setPromoCode(promoFromUrl.toUpperCase());
    }
    if (params.get('paid') === '1' || params.get('sub') === '1') {
      setMessage('Stripe updated — refreshing…');
      const sessionId = params.get('session_id');
      (async () => {
        try {
          if (params.get('sub') === '1' && sessionId && isOwner) {
            await jobsAPI.syncSubscriptionCheckout(orgSlug, sessionId);
          }
        } catch {
          /* webhook may still catch up */
        }
        await load();
        await refreshSession?.();
      })();
      const url = new URL(window.location.href);
      url.searchParams.delete('paid');
      url.searchParams.delete('sub');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
    const qbo = params.get('qbo');
    if (qbo) {
      if (qbo === '1') setMessage('QuickBooks connected.');
      else setError('QuickBooks connection failed. Try again from Billing.');
      load();
      const url = new URL(window.location.href);
      url.searchParams.delete('qbo');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [load, refreshSession, orgSlug, isOwner]);

  const redirectTo = async (fn) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fn();
      const url = res.data?.url || res.data?.checkout_url || res.data?.portal_url;
      if (!url) throw new Error('No Stripe URL returned');
      window.location.href = url;
    } catch (e) {
      setError(parseApiError(e) || 'Stripe request failed.');
      setBusy(false);
    }
  };

  const applyPromo = async () => {
    if (!promoCode.trim()) {
      setError('Enter a promo code.');
      return;
    }
    setPromoBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await jobsAPI.redeemPromoCode(orgSlug, promoCode.trim());
      setBilling(res.data);
      setPromoCode('');
      const end = res.data?.subscription?.current_period_end;
      setMessage(
        end
          ? `Promo applied — Pro access until ${new Date(end).toLocaleDateString()}.`
          : 'Promo applied.'
      );
      await refreshSession?.();
    } catch (e) {
      setError(parseApiError(e) || 'Could not apply promo code.');
    } finally {
      setPromoBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="lx-card">
        <p className="text-sm text-slate-500">Loading payments…</p>
      </section>
    );
  }

  if (!billing) {
    return (
      <section className="lx-card">
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    );
  }

  const feePercent = Number(billing.platform_fee_percent ?? 0.5);
  const feeLabel = Number.isInteger(feePercent)
    ? String(feePercent)
    : feePercent.toFixed(1).replace(/\.0$/, '');
  const connect = billing.connect || {};
  const payouts = billing.payouts || {};
  const qbo = billing.quickbooks || {};
  const sub = billing.subscription || {};
  const configured = billing.stripe_configured;
  const instantDollars = ((payouts.instant_available_cents || 0) / 100).toFixed(2);
  const currency = (payouts.currency || 'cad').toUpperCase();

  const canStartMonthly =
    (!sub.status || sub.status === 'none' || sub.status === 'canceled' || sub.source === 'promo') &&
    sub.prices_configured?.pro_monthly;
  const canStartYearly =
    (!sub.status || sub.status === 'none' || sub.status === 'canceled' || sub.source === 'promo') &&
    sub.prices_configured?.pro_yearly;
  const daysLeft = subscriptionDaysRemaining(sub.current_period_end);
  const endDate = sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString()
    : null;
  const planLabel =
    sub.plan && sub.plan !== 'free' ? sub.plan.replace(/_/g, ' ') : 'Luminexa Pro';

  let subDetail = 'Subscribe to use the provider dashboard.';
  if (sub.source === 'promo' && endDate) {
    subDetail =
      daysLeft === 0
        ? `Promo access ends today (${endDate}).`
        : `Promo access until ${endDate}${daysLeft != null ? ` · ${daysLeft} days left` : ''}.`;
  } else if (sub.status === 'trialing' && endDate) {
    subDetail =
      daysLeft === 0
        ? `Trial ends today (${endDate}). Add a card to keep Pro.`
        : `Trial until ${endDate} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`;
  } else if (sub.active && endDate) {
    subDetail = `Renews ${endDate}${daysLeft != null ? ` · ${daysLeft} days left` : ''}.`;
  } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
    subDetail = 'Payment failed. Update your card to keep Pro.';
  } else if (sub.trial_days > 0) {
    subDetail = `${sub.trial_days}-day free trial — no card needed to start. Then $9.99 CAD / month.`;
  }

  const runInstantPayout = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await jobsAPI.createInstantPayout(orgSlug, {});
      setBilling(res.data.billing || billing);
      setMessage(
        `Instant payout started for $${(res.data.amount_cents / 100).toFixed(2)} ${currency}.`
      );
      await load();
    } catch (e) {
      setError(parseApiError(e) || 'Instant payout failed.');
    } finally {
      setBusy(false);
    }
  };

  const runQbo = async (fn, okMsg) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fn();
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      if (res.data?.billing) setBilling(res.data.billing);
      else await load();
      if (okMsg) setMessage(okMsg);
      if (res.data?.synced != null) {
        setMessage(`Synced ${res.data.synced} invoice(s) to QuickBooks${res.data.errors ? ` (${res.data.errors} failed)` : ''}.`);
      }
    } catch (e) {
      setError(parseApiError(e) || 'QuickBooks request failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {!configured && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Online payments are not configured on this server yet. Cash and e-transfer mark-paid still work.
        </p>
      )}

      {message && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {/* 1. Luminexa Pro */}
      <section className="lx-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Your plan
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Luminexa Pro</h2>
            <p className="mt-0.5 text-sm text-slate-600">{planLabel} · $9.99 CAD / month</p>
          </div>
          <StatusPill tone={subTone(sub.status, sub.active)}>
            {statusCopy(sub.status)}
          </StatusPill>
        </div>

        <p className="text-sm text-slate-600">{subDetail}</p>

        <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <li className="rounded-xl bg-slate-50 px-3 py-2">Provider dashboard & bookings</li>
          <li className="rounded-xl bg-slate-50 px-3 py-2">Invoices & customer card pay</li>
          <li className="rounded-xl bg-slate-50 px-3 py-2">Analytics & job costing</li>
          <li className="rounded-xl bg-slate-50 px-3 py-2">Customers use Luminexa free</li>
        </ul>

        {isOwner && configured && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canStartMonthly && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  redirectTo(() =>
                    jobsAPI.startSubscription(orgSlug, {
                      plan: 'pro_monthly',
                      success_path: subscribeSuccessPath,
                      cancel_path: subscribeSuccessPath,
                    })
                  )
                }
                className="lx-btn-primary min-h-[48px] flex-1 sm:flex-none sm:px-6"
              >
                {busy
                  ? 'Opening Stripe…'
                  : sub.source === 'promo'
                    ? 'Upgrade to paid monthly'
                    : sub.trial_days > 0
                      ? 'Start free trial'
                      : 'Subscribe monthly'}
              </button>
            )}
            {canStartYearly && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  redirectTo(() =>
                    jobsAPI.startSubscription(orgSlug, {
                      plan: 'pro_yearly',
                      success_path: subscribeSuccessPath,
                      cancel_path: subscribeSuccessPath,
                    })
                  )
                }
                className="lx-btn-secondary min-h-[48px]"
              >
                {sub.source === 'promo' ? 'Upgrade to paid yearly' : 'Subscribe yearly'}
              </button>
            )}
            {sub.has_customer && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  redirectTo(() =>
                    jobsAPI.openBillingPortal(orgSlug, {
                      return_path: stripeReturnPath,
                    })
                  )
                }
                className="lx-btn-secondary min-h-[48px]"
              >
                Manage card & invoices
              </button>
            )}
          </div>
        )}

        {!isOwner && (
          <p className="text-sm text-amber-800">Only the business owner can change the plan.</p>
        )}

        {isOwner && configured && !sub.prices_configured?.pro_monthly && !sub.prices_configured?.pro_yearly && (
          <p className="text-sm text-amber-800">Subscription price is not configured yet.</p>
        )}

        {isOwner && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-700">Have a promo code?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="e.g. LAUNCH4W"
                autoCapitalize="characters"
                className="min-h-[44px] min-w-[10rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
              <button
                type="button"
                disabled={promoBusy || busy}
                onClick={applyPromo}
                className="lx-btn-secondary min-h-[44px]"
              >
                {promoBusy ? 'Applying…' : 'Apply code'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. Customer card payouts */}
      <section className="lx-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Get paid
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Customer card payments</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Customers pay your invoices. You receive the money. Luminexa takes {feeLabel}%;
              Stripe’s card fee is separate.
            </p>
          </div>
          <StatusPill tone={connectTone(connect)}>{connectLabel(connect)}</StatusPill>
        </div>

        <p className="text-sm text-slate-600">
          {connect.can_accept_cards
            ? 'Customers can pay invoices with a card, Apple Pay, or Google Pay.'
            : connect.details_submitted
              ? 'Stripe is reviewing your payout account, or more details are needed.'
              : 'Set up Stripe Express once so invoice payments go to your bank.'}
        </p>

        {isOwner && configured && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                redirectTo(() =>
                  jobsAPI.startConnectOnboarding(orgSlug, {
                    return_path: stripeReturnPath,
                  })
                )
              }
              className={
                connect.can_accept_cards
                  ? 'lx-btn-secondary min-h-[48px]'
                  : 'lx-btn-primary min-h-[48px]'
              }
            >
              {busy
                ? 'Opening Stripe…'
                : connect.account_id
                  ? 'Continue payout setup'
                  : 'Set up payouts'}
            </button>
            {connect.details_submitted && (
              <button
                type="button"
                disabled={busy}
                onClick={() => redirectTo(() => jobsAPI.openConnectDashboard(orgSlug))}
                className="lx-btn-secondary min-h-[48px]"
              >
                Stripe dashboard
              </button>
            )}
            {connect.payouts_enabled && (
              <button
                type="button"
                disabled={busy || !payouts.instant_supported}
                onClick={runInstantPayout}
                className="lx-btn-secondary min-h-[48px]"
                title={payouts.detail || ''}
              >
                {payouts.instant_supported
                  ? `Cash out now ($${instantDollars} ${currency})`
                  : 'Instant payout unavailable'}
              </button>
            )}
          </div>
        )}
        {connect.payouts_enabled && payouts.detail && (
          <p className="text-xs text-slate-500">{payouts.detail}</p>
        )}
      </section>

      {/* 3. QuickBooks */}
      <section className="lx-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Accounting
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">QuickBooks Online</h2>
          </div>
          <StatusPill tone={qbo.connected ? 'green' : 'slate'}>
            {qbo.connected ? 'Connected' : qbo.enabled ? 'Optional' : 'Not configured'}
          </StatusPill>
        </div>
        <p className="text-sm text-slate-600">
          {qbo.connected
            ? 'Luminexa pushes customers, invoices, and payments when jobs are paid.'
            : qbo.enabled
              ? 'Optional — connect to push paid invoices for your accountant.'
              : 'Not configured on this server.'}
        </p>
        {isOwner && qbo.enabled && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {!qbo.connected ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => runQbo(() => jobsAPI.connectQuickBooks(orgSlug))}
                className="lx-btn-secondary min-h-[48px]"
              >
                Connect QuickBooks
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runQbo(() => jobsAPI.syncQuickBooks(orgSlug))}
                  className="lx-btn-primary min-h-[48px]"
                >
                  Sync invoices now
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    runQbo(() => jobsAPI.disconnectQuickBooks(orgSlug), 'QuickBooks disconnected.')
                  }
                  className="lx-btn-secondary min-h-[48px]"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
