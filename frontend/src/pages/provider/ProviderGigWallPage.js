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
      .listGigWall({ category: category || undefined, status: 'all' })
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
    <div className="gig-wall-page">
      <div className="gig-wall-page__inner space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="lx-eyebrow">In your service area</p>
            <h1 className="gig-wall-page__title mt-0.5 text-xl font-bold tracking-tight">
              Gig wall
            </h1>
            <p className="gig-wall-page__lede mt-0.5 text-sm">
              Open requests pinned nearby. Place a bid to take the job.
            </p>
          </div>
          <Link to={providerMyGigQuotes(orgSlug)} className="gig-wall-link shrink-0">
            My bids
          </Link>
        </div>

        <GigCategoryFilter value={category} onChange={setCategory} />

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </p>
        )}

        {loading && (
          <p className="gig-wall-page__lede px-2 py-6 text-center text-sm font-medium">
            Loading the wall…
          </p>
        )}

        {!loading && posts.length === 0 && (
          <div className="gig-empty-board">
            <p className="text-sm font-medium text-teal-950">
              No open gigs to bid on in your service area right now.
            </p>
          </div>
        )}

        {!loading && posts.length > 0 && (
          <div className="gig-pin-board">
            {posts.map((post, idx) => (
              <GigPostCard
                key={post.id}
                post={post}
                index={idx}
                onClick={() => navigate(providerGigDetail(orgSlug, post.id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
