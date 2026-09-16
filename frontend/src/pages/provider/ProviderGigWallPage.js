import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import GigCategoryFilter from '../../components/gigs/GigCategoryFilter';
import GigPostCard from '../../components/gigs/GigPostCard';
import { jobsAPI } from '../../utils/api';
import { providerGigDetail, providerMyGigQuotes } from '../../utils/providerPaths';

export default function ProviderGigWallPage() {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listGigWall({ category: category || undefined, status: 'open' })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setPosts(list);
        setError(null);
      })
      .catch(() => setError('Could not load gigs in your area.'))
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-luminexa-ink">Gig wall</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Open requests in your service area.
          </p>
        </div>
        <Link
          to={providerMyGigQuotes(orgSlug)}
          className="text-sm font-semibold text-teal-700 hover:underline"
        >
          My quotes
        </Link>
      </div>
      <GigCategoryFilter value={category} onChange={setCategory} />
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && posts.length === 0 && (
        <p className="rounded-2xl border border-dashed border-teal-200 bg-luminexa-mist/60 px-4 py-8 text-center text-sm text-teal-900">
          No open gigs in your service area right now.
        </p>
      )}
      <div className="space-y-3">
        {posts.map((post) => (
          <GigPostCard
            key={post.id}
            post={post}
            onClick={() => navigate(providerGigDetail(orgSlug, post.id))}
          />
        ))}
      </div>
    </div>
  );
}
