import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GigCommentForm from '../../components/gigs/GigCommentForm';
import GigCommentThread from '../../components/gigs/GigCommentThread';
import GigQuoteForm from '../../components/gigs/GigQuoteForm';
import GigQuoteList from '../../components/gigs/GigQuoteList';
import { useAuth } from '../../contexts/AuthContext';
import { jobsAPI } from '../../utils/api';
import { customerGigs, customerGigBid, customerQuotes } from '../../utils/customerPaths';
import { providerGigs, providerGigBid, providerMyGigQuotes } from '../../utils/providerPaths';

function statusLabel(status) {
  if (status === 'open') return 'Open';
  if (status === 'quoted') return 'Has bids';
  if (status === 'accepted') return 'Accepted';
  if (status === 'closed') return 'Closed';
  return status || '';
}

function statusStampClass(status) {
  if (status === 'accepted') return 'text-emerald-700';
  if (status === 'closed') return 'text-slate-500';
  if (status === 'quoted') return 'text-teal-800';
  return 'text-teal-700';
}

function ownerStatusHint(status) {
  if (status === 'open') return 'On the wall — providers can send bids.';
  if (status === 'quoted') return 'On the wall — you have bids. Close it to stop new ones.';
  if (status === 'closed') return 'Off the wall — no new bids. Reopen to list it again.';
  if (status === 'accepted') return 'A bid was accepted. This gig stays off the wall.';
  return '';
}

export default function GigPostDetailPage({ mode = 'customer' }) {
  const { id, orgSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const activeTab = searchParams.get('tab') === 'quotes' ? 'quotes' : 'comments';

  const isProviderMode = mode === 'provider';
  const isOwner = !!(post && user && post.customer === user.id);
  const showBidsTab = isOwner || isProviderMode;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let postRes;
      if (isProviderMode) {
        postRes = await jobsAPI.getGigWallDetail(id);
      } else {
        postRes = await jobsAPI.getGig(id);
      }
      const postData = postRes.data;
      setPost(postData);
      const owner = !!(user && postData.customer === user.id);
      const cRes = await jobsAPI.listGigComments(id);
      setComments(Array.isArray(cRes.data) ? cRes.data : []);
      if (owner || isProviderMode) {
        const qRes = await jobsAPI.listGigQuotes(id);
        setQuotes(Array.isArray(qRes.data) ? qRes.data : []);
      } else {
        setQuotes([]);
      }
      setError(null);
    } catch {
      setError('Could not load this gig post.');
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id, isProviderMode, user]);

  useEffect(() => {
    load();
  }, [load]);

  const ownQuote = useMemo(() => {
    if (!isProviderMode) return null;
    return (
      quotes.find(
        (q) =>
          q.status === 'submitted' ||
          q.status === 'countered' ||
          q.status === 'accepted',
      ) ||
      quotes[0] ||
      null
    );
  }, [isProviderMode, quotes]);

  const setTab = (tab) => {
    setSearchParams(tab === 'quotes' ? { tab: 'quotes' } : {});
  };

  const backPath = isProviderMode ? providerGigs(orgSlug) : customerGigs();

  if (loading) {
    return (
      <div className="gig-wall-surface">
        <p className="px-2 py-8 text-center text-sm text-slate-600">Loading…</p>
      </div>
    );
  }
  if (error || !post) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || 'Not found'}
        </p>
        <Link to={backPath} className="text-sm text-slate-600 hover:underline">
          Back
        </Link>
      </div>
    );
  }

  const location = [
    post.location_address,
    post.location_city,
    post.location_state,
    post.location_postal_code,
  ]
    .filter(Boolean)
    .join(', ');

  const bidTabCount = quotes.length || (isProviderMode && !isOwner ? '—' : 0);

  return (
    <div className="space-y-4">
      <Link to={backPath} className="inline-flex text-sm font-medium text-teal-700 hover:underline">
        ← Back to gig wall
      </Link>

      <div className="gig-wall-surface space-y-3">
        <article className="gig-pin-sheet">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {isOwner && (
                  <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Yours
                  </span>
                )}
                <span className={`gig-pin-stamp ${statusStampClass(post.status)}`}>
                  {statusLabel(post.status)}
                </span>
                {post.category_name && (
                  <span className="gig-pin-chip">{post.category_name}</span>
                )}
              </div>
              <h1 className="text-xl font-bold tracking-tight text-luminexa-ink">{post.title}</h1>
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-slate-500">
                {!isOwner && post.customer_name && <span>{post.customer_name}</span>}
                <span>Within {post.search_radius_miles} mi</span>
              </div>
            </div>
          </div>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {post.description}
          </p>

          {location && (
            <div className="mt-4 flex items-start gap-2 border-t border-black/5 pt-3 text-sm text-slate-600">
              <span aria-hidden className="mt-0.5 shrink-0 text-base leading-none">
                📍
              </span>
              <p className="min-w-0 leading-relaxed">{location}</p>
            </div>
          )}

          {isOwner && ownerStatusHint(post.status) && (
            <p className="mt-3 text-sm text-slate-600">{ownerStatusHint(post.status)}</p>
          )}
        </article>

        {isOwner && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            {['open', 'quoted'].includes(post.status) && (
              <button
                type="button"
                disabled={statusBusy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      'Close this gig? It leaves the public wall and providers cannot send new bids. You can reopen it later.',
                    )
                  ) {
                    return;
                  }
                  setStatusBusy(true);
                  try {
                    const res = await jobsAPI.closeGig(post.id);
                    setPost(res.data);
                    setError(null);
                  } catch {
                    setError('Could not close this gig.');
                  } finally {
                    setStatusBusy(false);
                  }
                }}
                className="lx-btn-ghost px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {statusBusy ? 'Closing…' : 'Close gig'}
              </button>
            )}
            {post.status === 'closed' && (
              <button
                type="button"
                disabled={statusBusy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      'Reopen this gig so it shows on the wall again and providers can bid?',
                    )
                  ) {
                    return;
                  }
                  setStatusBusy(true);
                  try {
                    const res = await jobsAPI.reopenGig(post.id);
                    setPost(res.data);
                    setError(null);
                  } catch {
                    setError('Could not reopen this gig.');
                  } finally {
                    setStatusBusy(false);
                  }
                }}
                className="lx-btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {statusBusy ? 'Reopening…' : 'Reopen gig'}
              </button>
            )}
            <button
              type="button"
              disabled={deleteBusy}
              onClick={async () => {
                if (!window.confirm('Delete this gig post? This cannot be undone.')) return;
                setDeleteBusy(true);
                try {
                  await jobsAPI.deleteGig(post.id);
                  navigate(customerGigs());
                } catch {
                  setError('Could not delete this gig post.');
                  setDeleteBusy(false);
                }
              }}
              className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              {deleteBusy ? 'Deleting…' : 'Delete post'}
            </button>
          </div>
        )}

        {post.images?.length > 0 && (
          <section className="rounded-xl border border-black/5 bg-[#fffcf7]/90 p-3">
            <h2 className="text-sm font-semibold text-slate-900">Photos</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {post.images.map((img) => (
                <a
                  key={img.id}
                  href={img.image || img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-28 w-28 overflow-hidden rounded-lg border border-black/5 bg-slate-100 sm:h-32 sm:w-32"
                >
                  <img
                    src={img.image || img.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      <div
        className={`gig-segment${!showBidsTab ? ' gig-segment--solo' : ''}`}
        role="tablist"
        aria-label="Gig discussion"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'comments'}
          onClick={() => setTab('comments')}
          className={`gig-segment-btn${activeTab === 'comments' ? ' gig-segment-btn--active' : ''}`}
        >
          Comments ({comments.length})
        </button>
        {showBidsTab && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'quotes'}
            onClick={() => setTab('quotes')}
            className={`gig-segment-btn${activeTab === 'quotes' ? ' gig-segment-btn--active' : ''}`}
          >
            Bids ({bidTabCount})
          </button>
        )}
      </div>

      {activeTab === 'comments' && (
        <div className="space-y-3">
          <GigCommentThread comments={comments} />
          {(isOwner || isProviderMode) && ['open', 'quoted'].includes(post.status) && (
            <GigCommentForm
              onSubmit={async (body) => {
                await jobsAPI.createGigComment(post.id, body);
                const cRes = await jobsAPI.listGigComments(post.id);
                setComments(Array.isArray(cRes.data) ? cRes.data : []);
              }}
            />
          )}
        </div>
      )}

      {activeTab === 'quotes' && isOwner && (
        <GigQuoteList
          quotes={quotes}
          highlightLowest
          onOpenQuote={(q) => navigate(customerGigBid(post.id, q.id))}
        />
      )}

      {activeTab === 'quotes' && isProviderMode && !isOwner && (
        <div className="space-y-3">
          {ownQuote ? (
            <div className="space-y-3">
              <GigQuoteList
                quotes={[ownQuote]}
                emptyForProvider
                onOpenQuote={(q) => navigate(providerGigBid(orgSlug, post.id, q.id))}
              />
              {ownQuote.status === 'submitted' && (
                <GigQuoteForm
                  initialData={ownQuote}
                  loading={quoteBusy}
                  onSubmit={async (payload) => {
                    setQuoteBusy(true);
                    try {
                      await jobsAPI.updateGigQuote(post.id, ownQuote.id, payload);
                      await load();
                    } finally {
                      setQuoteBusy(false);
                    }
                  }}
                  onWithdraw={async () => {
                    setQuoteBusy(true);
                    try {
                      await jobsAPI.withdrawGigQuote(post.id, ownQuote.id);
                      await load();
                    } finally {
                      setQuoteBusy(false);
                    }
                  }}
                  withdrawBusy={quoteBusy}
                />
              )}
              {ownQuote.status === 'countered' && (
                <Link
                  to={providerGigBid(orgSlug, post.id, ownQuote.id)}
                  className="lx-btn-primary inline-flex px-4 py-2 text-sm"
                >
                  Review customer counter ${ownQuote.counter_price}
                </Link>
              )}
              {ownQuote.status === 'accepted' && (
                <Link
                  to={providerMyGigQuotes(orgSlug)}
                  className="inline-block text-sm font-medium text-emerald-700 hover:underline"
                >
                  Bid accepted — view my bids
                </Link>
              )}
            </div>
          ) : (
            ['open', 'quoted'].includes(post.status) && (
              <GigQuoteForm
                loading={quoteBusy}
                onSubmit={async (payload) => {
                  setQuoteBusy(true);
                  try {
                    await jobsAPI.createGigQuote(post.id, payload);
                    setTab('quotes');
                    await load();
                  } finally {
                    setQuoteBusy(false);
                  }
                }}
              />
            )
          )}
        </div>
      )}

      {isOwner && post.status === 'accepted' && (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
          Bid accepted. Open{' '}
          <Link to={customerQuotes()} className="font-semibold underline">
            Quotes
          </Link>{' '}
          to continue with the provider.
        </p>
      )}
    </div>
  );
}
