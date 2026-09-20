import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import { getCustomerBookingUrl } from '../../utils/bookingLink';
import {
  buildReferralShareUrl,
  captureReferralFromSearch,
} from '../../utils/referralStorage';
import LinkShareBar from '../LinkShareBar';

function formatMoney(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return '$0';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

/**
 * Customer-facing referral card on a provider storefront / book page.
 */
export default function CustomerReferralCard({
  orgSlug,
  orgPublicRef,
  rewardAmount,
  enabled,
  isLoggedIn,
}) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    captureReferralFromSearch(window.location.search, [orgSlug, orgPublicRef]);
  }, [orgSlug, orgPublicRef]);

  const load = useCallback(() => {
    if (!orgSlug || !isLoggedIn || !enabled) {
      setSummary(null);
      return;
    }
    jobsAPI
      .getReferral(orgSlug)
      .then((res) => setSummary(res.data))
      .catch(() => setSummary(null));
  }, [orgSlug, isLoggedIn, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const shareUrl = useMemo(() => {
    if (!summary?.code) return '';
    const base = getCustomerBookingUrl(orgPublicRef || orgSlug);
    return buildReferralShareUrl(base, summary.code);
  }, [summary?.code, orgSlug, orgPublicRef]);

  if (!enabled) return null;

  const rewardLabel = formatMoney(summary?.reward_amount ?? rewardAmount ?? 0);

  if (!isLoggedIn) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Refer a friend</p>
        <p className="mt-1 text-slate-600">
          Sign in to get your link. Earn {rewardLabel} in coupon credit when they complete a job
          here.
        </p>
      </section>
    );
  }

  if (!summary?.enabled || !summary?.code) return null;

  const atCap = Boolean(summary.at_cap);
  const maxLabel = formatMoney(summary.max_earnings_per_referrer || 0);
  const earnedLabel = formatMoney(summary.earned_total || 0);
  const avail = Number(summary.available_credit || 0);

  if (atCap) {
    return (
      <section className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-slate-800">
        <p className="font-medium text-slate-900">Max reward received</p>
        <p className="mt-1 text-slate-700">
          You&apos;ve earned the lifetime max for this business ({earnedLabel}
          {summary.max_earnings_per_referrer ? ` of ${maxLabel}` : ''}). Further referrals here
          won&apos;t add more credit
          {avail > 0 ? ` · ${formatMoney(avail)} still available to use on your next invoice` : ''}.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-sm text-slate-800">
      <p className="font-medium text-slate-900">Share &amp; earn {rewardLabel}</p>
      <p className="mt-1 text-slate-600">
        When someone books with your link and finishes a job, you get coupon credit on your next
        invoice here
        {avail > 0 ? ` · Available credit: ${formatMoney(avail)}` : ''}
        {summary.max_earnings_per_referrer
          ? ` · Up to ${maxLabel} lifetime at this business`
          : ''}
        .
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Code <span className="font-mono font-semibold text-slate-700">{summary.code}</span>
      </p>
      {shareUrl ? (
        <div className="mt-3">
          <LinkShareBar url={shareUrl} title="Share your referral link" compact />
        </div>
      ) : null}
    </section>
  );
}
