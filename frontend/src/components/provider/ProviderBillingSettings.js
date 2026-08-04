import React, { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { useAuth } from '../../contexts/AuthContext';

function statusCopy(status) {
  if (status === 'trialing') return 'Trialing';
  if (status === 'active') return 'Active';
  if (status === 'past_due') return 'Past due';
  if (status === 'canceled') return 'Canceled';
  if (status === 'unpaid') return 'Unpaid';
  return 'Not subscribed';
}

/**
 * Stripe Connect (customer card payouts) + provider Pro subscription.
 * Owner-only actions; staff can view status.
 */
export default function ProviderBillingSettings({ orgSlug, isOwner }) {
  const { refreshSession } = useAuth();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);

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
      else setError('QuickBooks connection failed. Try again from Settings.');
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
    <section className="lx-card space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase text-slate-500">Payments & plan</h2>
        <p className="mt-1 text-sm text-slate-600">
          Customers use Luminexa for free. Only your business subscribes. On invoice card payments,
          Luminexa takes a {feeLabel}% platform fee; Stripe’s card processing fee is separate and
          comes out of the charge as usual. Pro trials start without a card — add one later before
          the trial ends.
        </p>
      </div>

      {!configured && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Online payments are not configured on this server yet (missing Stripe keys). Cash and
          e-transfer mark-paid still work.
        </p>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Customer card payouts</h3>
        <p className="text-sm text-slate-600">
          {connect.can_accept_cards
            ? 'Ready — customers can pay invoices with a card.'
            : connect.details_submitted
              ? 'Stripe is reviewing your account, or more details are needed.'
              : 'Set up a Stripe Express account to receive card payments.'}
        </p>
        {isOwner && configured && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                redirectTo(() =>
                  jobsAPI.startConnectOnboarding(orgSlug, {
                    return_path: `/provider/${orgSlug}/settings`,
                  })
                )
              }
              className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {connect.account_id ? 'Continue payout setup' : 'Set up payouts'}
            </button>
            {connect.details_submitted && (
              <button
                type="button"
                disabled={busy}
                onClick={() => redirectTo(() => jobsAPI.openConnectDashboard(orgSlug))}
                className="min-h-[44px] rounded-xl bg-white px-4 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 disabled:opacity-60"
              >
                Stripe dashboard
              </button>
            )}
            {connect.payouts_enabled && (
              <button
                type="button"
                disabled={busy || !payouts.instant_supported}
                onClick={runInstantPayout}
                className="min-h-[44px] rounded-xl bg-white px-4 text-sm font-semibold text-teal-800 ring-1 ring-teal-200 disabled:opacity-60"
                title={payouts.detail || ''}
              >
                {payouts.instant_supported
                  ? `Cash out now ($${instantDollars} ${currency})`
                  : 'Instant payout unavailable'}
              </button>
            )}
          </div>
        )}
        {connect.payouts_enabled && (
          <p className="text-xs text-slate-500">{payouts.detail}</p>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">QuickBooks Online</h3>
        <p className="text-sm text-slate-600">
          {qbo.connected
            ? 'Connected — Luminexa pushes customers, invoices, and payments when jobs are paid.'
            : qbo.enabled
              ? 'Connect QuickBooks to push paid invoices for your accountant.'
              : 'Not configured on this server (add QuickBooks app credentials to env).'}
        </p>
        {isOwner && qbo.enabled && (
          <div className="flex flex-wrap gap-2">
            {!qbo.connected ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => runQbo(() => jobsAPI.connectQuickBooks(orgSlug))}
                className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                Connect QuickBooks
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runQbo(() => jobsAPI.syncQuickBooks(orgSlug))}
                  className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Sync invoices now
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    runQbo(() => jobsAPI.disconnectQuickBooks(orgSlug), 'QuickBooks disconnected.')
                  }
                  className="min-h-[44px] rounded-xl bg-white px-4 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 disabled:opacity-60"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">Luminexa Pro (providers only)</h3>
        <p className="text-sm text-slate-600">
          Status: {statusCopy(sub.status)}
          {sub.plan && sub.plan !== 'free' ? ` · ${sub.plan.replace('_', ' ')}` : ''}
          {sub.source === 'promo' && sub.current_period_end
            ? ` · Promo Pro until ${new Date(sub.current_period_end).toLocaleDateString()}`
            : sub.current_period_end
              ? ` · renews ${new Date(sub.current_period_end).toLocaleDateString()}`
              : ''}
          {sub.trial_days > 0 && (!sub.status || sub.status === 'none' || sub.status === 'canceled')
            ? ` · ${sub.trial_days}-day free trial`
            : ''}
        </p>
        {isOwner && (
          <div className="rounded-xl bg-slate-50 p-3">
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
                className="min-h-[44px] rounded-xl bg-white px-4 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 disabled:opacity-60"
              >
                {promoBusy ? 'Applying…' : 'Apply code'}
              </button>
            </div>
          </div>
        )}
        {isOwner && configured && (
          <div className="flex flex-wrap gap-2">
            {(!sub.status || sub.status === 'none' || sub.status === 'canceled' || sub.source === 'promo') &&
              sub.prices_configured?.pro_monthly && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    redirectTo(() =>
                      jobsAPI.startSubscription(orgSlug, {
                        plan: 'pro_monthly',
                        success_path: `/provider/${orgSlug}/subscribe`,
                        cancel_path: `/provider/${orgSlug}/subscribe`,
                      })
                    )
                  }
                  className="min-h-[44px] rounded-xl bg-luminexa-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {sub.source === 'promo'
                    ? 'Upgrade to paid monthly'
                    : sub.trial_days > 0
                      ? 'Start free trial'
                      : 'Subscribe monthly'}
                </button>
              )}
            {(!sub.status || sub.status === 'none' || sub.status === 'canceled' || sub.source === 'promo') &&
              sub.prices_configured?.pro_yearly && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    redirectTo(() =>
                      jobsAPI.startSubscription(orgSlug, {
                        plan: 'pro_yearly',
                        success_path: `/provider/${orgSlug}/subscribe`,
                        cancel_path: `/provider/${orgSlug}/subscribe`,
                      })
                    )
                  }
                  className="min-h-[44px] rounded-xl bg-white px-4 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 disabled:opacity-60"
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
                      return_path: `/provider/${orgSlug}/settings`,
                    })
                  )
                }
                className="min-h-[44px] rounded-xl bg-white px-4 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 disabled:opacity-60"
              >
                Manage billing
              </button>
            )}
            {!sub.prices_configured?.pro_monthly && !sub.prices_configured?.pro_yearly && (
              <p className="text-xs text-slate-500">
                Subscription prices are not configured (STRIPE_PRICE_PRO_MONTHLY / YEARLY).
              </p>
            )}
          </div>
        )}
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
