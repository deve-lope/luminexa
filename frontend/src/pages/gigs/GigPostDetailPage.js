import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GigCommentForm from '../../components/gigs/GigCommentForm';
import GigCommentThread from '../../components/gigs/GigCommentThread';
import GigQuoteForm from '../../components/gigs/GigQuoteForm';
import GigQuoteList from '../../components/gigs/GigQuoteList';
import { useAuth } from '../../contexts/AuthContext';
import { jobsAPI } from '../../utils/api';
import { customerGigs, customerQuotes } from '../../utils/customerPaths';
import { providerGigs, providerMyGigQuotes } from '../../utils/providerPaths';

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
  const activeTab = searchParams.get('tab') === 'quotes' ? 'quotes' : 'comments';

  const isProviderMode = mode === 'provider';
  const isOwner = !!(post && user && post.customer === user.id);

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
      quotes.find((q) => q.status === 'submitted' || q.status === 'accepted') ||
      quotes[0] ||
      null
    );
  }, [isProviderMode, quotes]);

  const setTab = (tab) => {
    setSearchParams(tab === 'quotes' ? { tab: 'quotes' } : {});
  };

  const backPath = isProviderMode ? providerGigs(orgSlug) : customerGigs();

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={backPath} className="text-sm font-medium text-teal-700 hover:underline">
            ← Back to gig wall
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-luminexa-ink">{post.title}</h1>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
            {isOwner && (
              <span className="rounded-full bg-teal-700 px-2 py-0.5 font-semibold text-white">
                Yours
              </span>
            )}
            <span className="rounded-full bg-luminexa-mist px-2 py-0.5 font-medium text-teal-800">
              {post.status}
            </span>
            {post.category_name && (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-800">
                {post.category_name}
              </span>
            )}
            {!isOwner && post.customer_name && <span>{post.customer_name}</span>}
            <span>Within {post.search_radius_miles} mi</span>
          </div>
        </div>
        {isOwner && (
          <button
            type="button"
            disabled={deleteBusy}
            onClick={async () => {
              if (!window.confirm('Delete this gig post? This cannot be undone.')) return;
              setDeleteBusy(true);
              try {
                await jobsAPI.closeGig(post.id);
                navigate(customerGigs());
              } catch {
                setError('Could not delete this gig post.');
                setDeleteBusy(false);
              }
            }}
            className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50"
          >
            {deleteBusy ? 'Deleting…' : 'Delete post'}
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-luminexa-line bg-white p-4 shadow-lx-soft">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{post.description}</p>
        {location && <p className="mt-3 text-sm text-slate-600">{location}</p>}
      </div>

      {post.images?.length > 0 && (
        <section className="rounded-2xl border border-luminexa-line bg-white p-4 shadow-lx-soft">
          <h2 className="text-sm font-semibold text-slate-900">Images</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {post.images.map((img) => (
              <img
                key={img.id}
                src={img.image || img.url}
                alt=""
                className="aspect-square w-full rounded-xl object-cover"
              />
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2 border-b border-luminexa-line">
        <button
          type="button"
          onClick={() => setTab('comments')}
          className={`px-3 py-2 text-sm font-semibold ${
            activeTab === 'comments'
              ? 'border-b-2 border-teal-700 text-teal-800'
              : 'text-slate-500'
          }`}
        >
          Comments ({comments.length})
        </button>
        {(isOwner || isProviderMode) && (
          <button
            type="button"
            onClick={() => setTab('quotes')}
            className={`px-3 py-2 text-sm font-semibold ${
              activeTab === 'quotes'
                ? 'border-b-2 border-teal-700 text-teal-800'
                : 'text-slate-500'
            }`}
          >
            Quotes ({isOwner ? quotes.length : quotes.length || '—'})
          </button>
        )}
      </div>

      {activeTab === 'comments' && (
        <div className="space-y-3">
          <GigCommentThread comments={comments} />
          {(isOwner || isProviderMode) && post.status !== 'closed' && (
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
          canAccept={['open', 'quoted'].includes(post.status)}
          onAcceptQuote={async (quoteId) => {
            await jobsAPI.acceptGigQuote(post.id, quoteId);
            await load();
          }}
        />
      )}

      {activeTab === 'quotes' && isProviderMode && !isOwner && (
        <div className="space-y-3">
          {ownQuote ? (
            <div className="space-y-3">
              <GigQuoteList quotes={[ownQuote]} canAccept={false} />
              {ownQuote.status === 'submitted' && (
                <>
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
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await jobsAPI.withdrawGigQuote(post.id, ownQuote.id);
                      await load();
                    }}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700"
                  >
                    Withdraw quote
                  </button>
                </>
              )}
              {ownQuote.status === 'accepted' && (
                <Link
                  to={providerMyGigQuotes(orgSlug)}
                  className="inline-block text-sm font-medium text-emerald-700 hover:underline"
                >
                  Quote accepted — view my quotes
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
        <p className="text-sm text-slate-600">
          Quote accepted. Open{' '}
          <Link to={customerQuotes()} className="underline">
            Quotes
          </Link>{' '}
          to continue with the provider.
        </p>
      )}
    </div>
  );
}
