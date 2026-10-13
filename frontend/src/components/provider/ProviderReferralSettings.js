import React, { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';

/**
 * Owner settings: enable referral rewards, per-referral amount, lifetime cap,
 * and per-job usage caps (% of invoice + max $).
 * Toggle off stops new referrals; existing coupon credit still applies on invoices.
 */
export default function ProviderReferralSettings({ orgSlug, isOwner, embedded = false }) {
  const [enabled, setEnabled] = useState(false);
  const [rewardAmount, setRewardAmount] = useState('10');
  const [maxEarnings, setMaxEarnings] = useState('100');
  const [maxPercentPerJob, setMaxPercentPerJob] = useState('50');
  const [maxAmountPerJob, setMaxAmountPerJob] = useState('100');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const payloadAmounts = () => ({
    referral_reward_amount: rewardAmount === '' ? '0' : rewardAmount,
    referral_max_earnings_per_referrer: maxEarnings === '' ? '0' : maxEarnings,
    referral_max_credit_percent_per_job: maxPercentPerJob === '' ? '0' : maxPercentPerJob,
    referral_max_credit_amount_per_job: maxAmountPerJob === '' ? '0' : maxAmountPerJob,
  });

  const amountsLookValid = () => {
    const reward = Number(rewardAmount);
    const cap = Number(maxEarnings);
    const pct = Number(maxPercentPerJob);
    const perJob = Number(maxAmountPerJob);
    return reward > 0 && cap > 0 && pct > 0 && pct <= 100 && perJob > 0;
  };

  const fetchOrg = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError('');
    try {
      const res = await jobsAPI.getOrganization(orgSlug);
      const d = res.data;
      setEnabled(Boolean(d.referral_rewards_enabled));
      setRewardAmount(
        d.referral_reward_amount != null ? String(d.referral_reward_amount) : '10'
      );
      setMaxEarnings(
        d.referral_max_earnings_per_referrer != null
          ? String(d.referral_max_earnings_per_referrer)
          : '100'
      );
      setMaxPercentPerJob(
        d.referral_max_credit_percent_per_job != null
          ? String(d.referral_max_credit_percent_per_job)
          : '50'
      );
      setMaxAmountPerJob(
        d.referral_max_credit_amount_per_job != null &&
          Number(d.referral_max_credit_amount_per_job) > 0
          ? String(d.referral_max_credit_amount_per_job)
          : '100'
      );
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const toggleEnabled = async () => {
    if (!isOwner || toggling) return;
    const next = !enabled;
    if (next && !amountsLookValid()) {
      setEnabled(true);
      setError(
        'Set credit per referral, lifetime cap, and per-job limits (% and $), then save to turn rewards on.'
      );
      setMessage('');
      return;
    }

    setToggling(true);
    setMessage('');
    setError('');
    const prev = enabled;
    setEnabled(next);
    try {
      await jobsAPI.patchOrganization(orgSlug, {
        referral_rewards_enabled: next,
        // Keep amounts when toggling so existing pending referrals can still qualify.
        ...payloadAmounts(),
      });
      setMessage(
        next
          ? 'Referral rewards are on. Customers can share links again.'
          : 'Referral rewards are off. No new referrals — existing coupon credit still applies.'
      );
    } catch (e) {
      setEnabled(prev);
      setError(parseApiError(e));
    } finally {
      setToggling(false);
    }
  };

  const save = async () => {
    if (!isOwner) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await jobsAPI.patchOrganization(orgSlug, {
        referral_rewards_enabled: enabled,
        ...payloadAmounts(),
      });
      setMessage('Referral amounts saved.');
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className={embedded ? '' : 'lx-card'}>
        <p className="text-sm text-slate-500">Loading referral settings…</p>
      </section>
    );
  }

  return (
    <section className={embedded ? 'space-y-4' : 'lx-card space-y-4'}>
      {!embedded && (
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Referral rewards</h2>
          <p className="mt-1 text-sm text-slate-600">
            Reward customers with coupon credit when someone they refer completes a job with you.
          </p>
        </div>
      )}
      {embedded && (
        <p className="text-sm text-slate-600">
          Reward customers with coupon credit when someone they refer completes a job with you.
          Credit applies automatically on their next invoice with your business, within the per-job
          limits you set.
        </p>
      )}

      {!isOwner ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Only the business owner can change referral rewards.
          {enabled ? ' Currently on.' : ' Currently off.'}
        </p>
      ) : (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-busy={toggling}
            disabled={toggling}
            onClick={toggleEnabled}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-luminexa-accent/40 disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">
                Offer referral rewards
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {enabled
                  ? 'On — customers get a share link. Credit is issued only after the referred person’s job is completed.'
                  : 'Off — no new referrals. Coupon credit customers already earned still applies on their invoices.'}
              </span>
            </span>
            <span
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                enabled ? 'bg-luminexa-accent' : 'bg-slate-300'
              }`}
              aria-hidden
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </span>
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-800">Credit per referral</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={rewardAmount}
                onChange={(e) => setRewardAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-800">Max a person can earn</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={maxEarnings}
                onChange={(e) => setMaxEarnings(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Lifetime cap of coupon credit for one customer at this business.
              </span>
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Max credit used per job</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Both limits apply — whichever is lower. Example: 50% and $100 on a $1,000 job → $100
                off (not $500).
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-slate-800">Max percent of job</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    inputMode="decimal"
                    value={maxPercentPerJob}
                    onChange={(e) => setMaxPercentPerJob(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                  />
                  <span className="shrink-0 text-slate-600">%</span>
                </div>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-800">Max dollars per job</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="shrink-0 text-slate-600">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={maxAmountPerJob}
                    onChange={(e) => setMaxAmountPerJob(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                  />
                </div>
              </label>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={save}
            aria-busy={saving}
            className="w-full min-h-[48px] rounded-xl bg-luminexa-accent font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save amounts'}
          </button>
        </>
      )}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
