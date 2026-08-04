import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';
import { providerBilling } from '../../utils/providerPaths';
import { subscriptionDaysRemaining } from '../../utils/providerSubscription';

function statusLabel(status) {
  if (status === 'trialing') return 'Trial';
  if (status === 'active') return 'Active';
  if (status === 'past_due') return 'Past due';
  if (status === 'canceled') return 'Canceled';
  if (status === 'unpaid') return 'Unpaid';
  return 'Not subscribed';
}

/**
 * Compact subscription summary for My Account — days left + link to billing details.
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

  const daysLeft = subscriptionDaysRemaining(sub?.current_period_end);
  const isActive = Boolean(sub?.active);
  const planLabel =
    sub?.plan && sub.plan !== 'free' ? sub.plan.replace(/_/g, ' ') : null;
  const endDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString()
    : null;

  let detail = 'No active Pro subscription.';
  if (isActive && daysLeft != null) {
    const dayWord = daysLeft === 1 ? 'day' : 'days';
    if (sub.source === 'promo') {
      detail =
        daysLeft === 0
          ? `Promo Pro ends today (${endDate}).`
          : `${daysLeft} ${dayWord} left on promo Pro · until ${endDate}`;
    } else if (sub.status === 'trialing') {
      detail =
        daysLeft === 0
          ? `Trial ends today (${endDate}).`
          : `${daysLeft} ${dayWord} left in trial · until ${endDate}`;
    } else {
      detail =
        daysLeft === 0
          ? `Renews today (${endDate}).`
          : `${daysLeft} ${dayWord} left · renews ${endDate}`;
    }
  } else if (isActive) {
    detail = `${statusLabel(sub?.status)}${planLabel ? ` · ${planLabel}` : ''}`;
  } else if (sub?.status && sub.status !== 'none') {
    detail = statusLabel(sub.status);
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase text-slate-500">Manage subscription</h2>
      <p className="mt-1 text-sm text-slate-600">
        Luminexa Pro for this business. Billing, promo codes, and payouts are on the next screen.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading subscription…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isActive ? statusLabel(sub?.status) : 'Status'}
            {planLabel ? ` · ${planLabel}` : ''}
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900">{detail}</p>
        </div>
      )}

      <Link
        to={providerBilling(orgSlug)}
        className="mt-4 flex min-h-[48px] w-full items-center justify-between rounded-xl border border-slate-200 px-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        <span>Manage billing</span>
        <span className="text-slate-400" aria-hidden>
          →
        </span>
      </Link>
    </section>
  );
}
