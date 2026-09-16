import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { jobsAPI } from '../../utils/api';
import {
  customerGigDetail,
  customerMessages,
  customerProviderPage,
  customerQuotes,
} from '../../utils/customerPaths';
import {
  providerGigDetail,
  providerMessages,
  providerMyGigQuotes,
} from '../../utils/providerPaths';

function statusLabel(status) {
  if (status === 'submitted') return 'Open bid';
  if (status === 'countered') return 'Counter pending';
  if (status === 'accepted') return 'Accepted';
  if (status === 'rejected') return 'Rejected';
  if (status === 'withdrawn') return 'Withdrawn';
  return status || '';
}

export default function GigBidDetailPage({ mode = 'customer' }) {
  const { id: gigId, quoteId, orgSlug } = useParams();
  const navigate = useNavigate();
  const isProvider = mode === 'provider';

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMessage, setCounterMessage] = useState('');

  const backPath = isProvider
    ? providerGigDetail(orgSlug, gigId)
    : customerGigDetail(gigId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await jobsAPI.getGigQuote(gigId, quoteId);
      setQuote(res.data);
      setError(null);
      if (res.data?.counter_price) {
        setCounterPrice(String(res.data.counter_price));
      }
    } catch {
      setError('Could not load this bid.');
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [gigId, quoteId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      const data = err?.response?.data;
      const msg =
        data?.detail ||
        data?.price ||
        (typeof data === 'object' ? Object.values(data).flat()?.[0] : null) ||
        'Something went wrong.';
      setError(String(msg));
    } finally {
      setBusy(false);
    }
  };

  const openChat = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await jobsAPI.openGigQuoteConversation(gigId, quoteId);
      const cid = res.data?.conversation_id;
      if (!cid) throw new Error('No conversation');
      if (isProvider) {
        navigate(`${providerMessages(orgSlug)}?conversation=${cid}`);
      } else {
        navigate(`${customerMessages()}?conversation=${cid}`);
      }
    } catch {
      setError('Could not open chat.');
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading bid…</p>;
  }
  if (error && !quote) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        <Link to={backPath} className="text-sm text-teal-700 hover:underline">
          Back
        </Link>
      </div>
    );
  }

  const org = quote.organization || {};
  const providerKey = org.public_ref || org.slug || null;
  const providerPage = providerKey ? customerProviderPage(providerKey) : null;
  const gigTitle = quote.gig_post?.title || 'Gig';
  const canCustomerAct =
    !isProvider &&
    ['submitted', 'countered'].includes(quote.status) &&
    ['open', 'quoted'].includes(quote.gig_post?.status || 'open');
  const canProviderCounterAct = isProvider && quote.status === 'countered';
  const canProviderWithdraw =
    isProvider && ['submitted', 'countered'].includes(quote.status);

  return (
    <div className="space-y-4">
      <Link to={backPath} className="inline-flex text-sm font-medium text-teal-700 hover:underline">
        ← Back to gig
      </Link>

      <div className="gig-wall-surface">
        <article className="gig-pin-sheet space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bid on
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-luminexa-ink">
                {gigTitle}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {org.logo && (
                  <img
                    src={org.logo}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-black/5"
                  />
                )}
                <div className="min-w-0">
                  {!isProvider && providerPage ? (
                    <Link
                      to={providerPage}
                      className="text-sm font-semibold text-teal-800 hover:underline"
                    >
                      {org.name || 'Provider'}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-slate-800">
                      {org.name || 'Provider'}
                    </p>
                  )}
                  {!isProvider && providerPage && (
                    <Link
                      to={providerPage}
                      className="mt-0.5 block text-xs font-medium text-teal-700 hover:underline"
                    >
                      View provider page →
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <span className="gig-pin-stamp text-teal-800">{statusLabel(quote.status)}</span>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-black/5 pt-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Provider bid
              </p>
              <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                ${quote.price}
              </p>
            </div>
            {quote.counter_price != null && quote.status === 'countered' && (
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
                  Your counter
                </p>
                <p className="text-2xl font-extrabold text-teal-800">
                  ${quote.counter_price}
                </p>
              </div>
            )}
          </div>

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {quote.description}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {quote.estimated_duration_days != null && (
              <span className="gig-pin-chip">
                Est. {quote.estimated_duration_days} day(s)
              </span>
            )}
            {quote.organization_distance != null && (
              <span className="gig-pin-chip">{quote.organization_distance} mi away</span>
            )}
            {quote.organization_rating != null && (
              <span className="gig-pin-chip">★ {quote.organization_rating}</span>
            )}
          </div>

          {quote.counter_message && quote.status === 'countered' && (
            <div className="rounded-xl border border-teal-100 bg-teal-50/80 px-3 py-2 text-sm text-teal-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                Counter note
              </p>
              <p className="mt-1 whitespace-pre-wrap">{quote.counter_message}</p>
            </div>
          )}
        </article>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {canCustomerAct && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await jobsAPI.acceptGigQuote(gigId, quoteId);
                  navigate(customerQuotes());
                })
              }
              className="lx-btn-primary disabled:opacity-50"
            >
              Accept ${quote.price}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm('Reject this bid? You can still talk to other providers.')) {
                  return;
                }
                run(async () => {
                  await jobsAPI.rejectGigQuote(gigId, quoteId);
                  navigate(customerGigDetail(gigId));
                });
              }}
              className="rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          </div>

          {!showCounter ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowCounter(true)}
              className="lx-btn-secondary w-full"
            >
              Negotiate — propose another price
            </button>
          ) : (
            <form
              className="gig-bid-card space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await jobsAPI.counterGigQuote(gigId, quoteId, {
                    price: counterPrice,
                    message: counterMessage,
                  });
                  setShowCounter(false);
                });
              }}
            >
              <h2 className="font-bold text-slate-900">Your counter-offer</h2>
              <p className="text-sm text-slate-600">
                The provider can accept this price or keep their original bid.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Price *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={counterPrice}
                    onChange={(e) => setCounterPrice(e.target.value)}
                    className="lx-input text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Note (optional)
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  className="lx-input resize-y text-sm"
                  placeholder="Why this price works for you…"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="lx-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  Send counter
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowCounter(false)}
                  className="lx-btn-ghost px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {canProviderCounterAct && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await jobsAPI.acceptGigQuoteCounter(gigId, quoteId);
                navigate(providerMyGigQuotes(orgSlug));
              })
            }
            className="lx-btn-primary disabled:opacity-50"
          >
            Accept ${quote.counter_price}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await jobsAPI.declineGigQuoteCounter(gigId, quoteId);
              })
            }
            className="lx-btn-ghost disabled:opacity-50"
          >
            Keep my ${quote.price} bid
          </button>
        </div>
      )}

      {isProvider && canProviderWithdraw && (
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${providerGigDetail(orgSlug, gigId)}?tab=quotes`}
            className="lx-btn-secondary flex-1 px-4 py-2 text-center text-sm"
          >
            Edit bid
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Withdraw this bid? You can place a new one later.')) {
                return;
              }
              run(async () => {
                await jobsAPI.withdrawGigQuote(gigId, quoteId);
                navigate(providerGigDetail(orgSlug, gigId));
              });
            }}
            className="flex-1 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            Withdraw bid
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={openChat}
        className="lx-btn-secondary w-full"
      >
        Message {isProvider ? 'customer' : 'provider'}
      </button>

      {quote.status === 'accepted' && !isProvider && (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
          Bid accepted.{' '}
          <Link to={customerQuotes()} className="font-semibold underline">
            Open Quotes
          </Link>{' '}
          to continue.
        </p>
      )}
    </div>
  );
}
