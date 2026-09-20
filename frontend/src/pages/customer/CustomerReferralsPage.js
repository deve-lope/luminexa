import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Skeleton, { SkeletonList } from '../../components/Skeleton';
import { jobsAPI } from '../../utils/api';
import { businessPage, customerFind } from '../../utils/customerPaths';

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

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function providerKey(row) {
  return row.organization_public_ref || row.organization_slug;
}

export default function CustomerReferralsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listMyReferrals()
      .then((res) => {
        setData(res.data || null);
        setError(null);
      })
      .catch(() => setError('Could not load referrals.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const credits = data?.credits || [];
  const completed = data?.completed || [];
  const pending = data?.pending || [];
  const empty = !loading && !error && credits.length === 0 && completed.length === 0 && pending.length === 0;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading referrals">
          <Skeleton className="h-20 w-full" />
          <SkeletonList count={2} />
        </div>
      ) : empty ? (
        <div className="lx-empty">
          <p className="text-slate-600">No referrals yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Open a business page that offers referral rewards, share your link, and earn credit when
            they finish a job.
          </p>
          <Link
            to={customerFind()}
            className="lx-btn-primary mt-4 inline-flex min-h-[48px] items-center px-6"
          >
            Find a service
          </Link>
        </div>
      ) : (
        <>
          {data?.how_to_use ? (
            <section className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-slate-800">
              <p className="font-medium text-slate-900">How to use your credit</p>
              <p className="mt-1 text-slate-700">{data.how_to_use}</p>
            </section>
          ) : null}

          {credits.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">By business</h2>
              <ul className="space-y-2">
                {credits.map((row) => {
                  const key = providerKey(row);
                  const avail = Number(row.available_credit || 0);
                  const atCap = Boolean(row.at_cap);
                  const maxLabel = formatMoney(row.max_earnings_per_referrer || 0);
                  const earnedLabel = formatMoney(row.earned_total || 0);
                  return (
                    <li
                      key={row.organization_slug}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{row.organization_name}</p>
                          {atCap ? (
                            <p className="mt-0.5 text-sm text-amber-800">
                              Max reward received: {earnedLabel}
                              {Number(row.max_earnings_per_referrer) > 0 ? ` (lifetime max ${maxLabel})` : ''}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-sm text-slate-600">
                              {earnedLabel} earned
                              {Number(row.max_earnings_per_referrer) > 0
                                ? ` of ${maxLabel} max`
                                : ''}
                            </p>
                          )}
                          <p className="mt-0.5 text-sm text-slate-600">
                            {avail > 0
                              ? `${formatMoney(avail)} left to use here`
                              : 'All credit used on invoices'}
                          </p>
                        </div>
                        {avail > 0 && key ? (
                          <Link
                            to={businessPage(key)}
                            className="lx-btn-primary shrink-0 px-3 py-2 text-sm"
                          >
                            Book here
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {completed.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Completed referrals</h2>
              <ul className="space-y-2">
                {completed.map((row) => {
                  const key = providerKey(row);
                  const remaining = Number(row.remaining || 0);
                  const isCapped = row.status === 'capped';
                  return (
                    <li
                      key={row.id}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">
                            {isCapped ? (
                              <>
                                No new credit
                                <span className="ml-2 text-xs font-normal text-amber-800">
                                  Max reward already received
                                  {Number(row.earned_total) > 0
                                    ? ` (${formatMoney(row.earned_total)})`
                                    : ''}
                                </span>
                              </>
                            ) : (
                              formatMoney(row.amount)
                            )}
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            Referred <span className="font-medium">{row.referred_name}</span>
                          </p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            At {row.organization_name}
                          </p>
                          {row.rewarded_at ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(row.rewarded_at)}
                              {!isCapped && remaining > 0
                                ? ` · ${formatMoney(remaining)} still available`
                                : !isCapped && Number(row.amount) > 0
                                  ? ' · Fully used'
                                  : isCapped && Number(row.max_earnings_per_referrer) > 0
                                    ? ` · Lifetime max ${formatMoney(row.max_earnings_per_referrer)}`
                                    : ''}
                            </p>
                          ) : null}
                        </div>
                        {key ? (
                          <Link
                            to={businessPage(key)}
                            className="shrink-0 text-sm font-medium text-teal-700 underline-offset-2 hover:underline"
                          >
                            {remaining > 0 ? 'Use credit' : 'View'}
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {pending.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Waiting on a completed job</h2>
              <ul className="space-y-2">
                {pending.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{row.referred_name}</span> booked at{' '}
                      <span className="font-medium">{row.organization_name}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Credit unlocks when their first job is marked done.
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
