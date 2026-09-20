import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { isNativeApp } from '../../native/capacitorNative';
import { providerBilling } from '../../utils/providerPaths';
import {
  formatSubscriptionPeriodEnd,
  formatSubscriptionRemainingLabel,
} from '../../utils/providerSubscription';

function statusLabel(sub) {
  if (sub?.source === 'promo') return 'Promo';
  if (sub?.status === 'trialing') return 'Trial';
  if (sub?.status === 'active') return 'Active';
  if (sub?.status === 'past_due') return 'Past due';
  if (sub?.status === 'canceled') return 'Canceled';
  if (sub?.status === 'unpaid') return 'Unpaid';
  return 'Not subscribed';
}

/**
 * Compact subscription summary for My Account — end date + human remaining time.
 */
export default function ProviderSubscriptionCard({ orgSlug }) {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await jobsAPI.getOrgBilling(orgSlug);
      setSub(res.data?.subscription || null);
    } catch (e) {
      setError(parseApiError(e) || 'Could not load subscription.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const isActive = Boolean(sub?.active);
  const planLabel =
    sub?.plan && sub.plan !== 'free' ? sub.plan.replace(/_/g, ' ') : null;
  const endDate = formatSubscriptionPeriodEnd(sub?.current_period_end);
  const remaining = formatSubscriptionRemainingLabel(sub?.current_period_end);

  let headline = 'No active Pro subscription.';
  let subline = null;
  if (isActive && endDate) {
    if (sub.source === 'promo') {
      headline = `Access until ${endDate}`;
    } else if (sub.status === 'trialing') {
      headline = `Trial until ${endDate}`;
    } else {
      headline = `Renews ${endDate}`;
    }
    subline = remaining;
  } else if (isActive) {
    headline = `${statusLabel(sub)}${planLabel ? ` · ${planLabel}` : ''}`;
  } else if (sub?.status && sub.status !== 'none') {
    headline = statusLabel(sub);
  }

  const storeShell = isNativeApp();

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase text-slate-500">
        {storeShell ? 'Subscription' : 'Manage subscription'}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {storeShell
          ? 'Luminexa Pro status for this business. Full billing details are on the website.'
          : 'Luminexa Pro for this business. Billing, promo codes, and payouts are on the next screen.'}
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading subscription…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isActive ? statusLabel(sub) : 'Status'}
            {planLabel ? ` · ${planLabel}` : ''}
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900">{headline}</p>
          {subline ? (
            <p className="mt-0.5 text-sm text-slate-600">{subline}</p>
          ) : null}
        </div>
      )}

      <Link
        to={providerBilling(orgSlug)}
        className="mt-4 flex min-h-[48px] w-full items-center justify-between rounded-xl border border-slate-200 px-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        <span>{storeShell ? 'View billing status' : 'Manage billing'}</span>
        <span className="text-slate-400" aria-hidden>
          →
        </span>
      </Link>
    </section>
  );
}
