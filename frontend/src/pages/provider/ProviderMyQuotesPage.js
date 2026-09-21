import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { jobsAPI } from '../../utils/api';
import { providerGigBid, providerGigs } from '../../utils/providerPaths';

export default function ProviderMyQuotesPage() {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listMyGigQuotes(filter === 'all' ? undefined : { status: filter })
      .then((res) => {
        setQuotes(Array.isArray(res.data) ? res.data : []);
        setError(null);
      })
      .catch(() => setError('Could not load your bids.'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">My bids</h1>
        <Link to={providerGigs(orgSlug)} className="text-sm text-slate-600 hover:underline">
          Gig wall
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {['all', 'submitted', 'countered', 'accepted', 'rejected', 'withdrawn'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && quotes.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          You haven&apos;t placed any bids yet.
        </p>
      )}
      <div className="space-y-3">
        {quotes.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => navigate(providerGigBid(orgSlug, q.gig_post.id, q.id))}
            className="gig-bid-card w-full text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{q.gig_post?.title}</h3>
                <p className="text-sm text-slate-600">
                  Customer: {q.gig_post?.customer_name || '—'}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-700">{q.description}</p>
                {q.status === 'countered' && q.counter_price != null && (
                  <p className="mt-1 text-sm font-medium text-teal-800">
                    Counter offered: ${q.counter_price}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">${q.price}</div>
                <span className="text-xs text-slate-500">{q.status}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
