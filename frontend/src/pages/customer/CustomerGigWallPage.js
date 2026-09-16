import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GigCategoryFilter from '../../components/gigs/GigCategoryFilter';
import GigPostCard from '../../components/gigs/GigPostCard';
import { jobsAPI } from '../../utils/api';
import { customerGigCreate, customerGigDetail } from '../../utils/customerPaths';

export default function CustomerGigWallPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listMyGigs()
      .then((res) => {
        let list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        if (category) {
          list = list.filter((p) => p.category_slug === category);
        }
        setPosts(list);
        setError(null);
      })
      .catch(() => setError('Could not load the gig wall.'))
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const mineCount = posts.filter((p) => p.is_mine).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-luminexa-ink">Gig wall</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Everyone&apos;s help requests. Yours stay on top.
          </p>
        </div>
        <Link
          to={customerGigCreate()}
          className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
        >
          Post a request
        </Link>
      </div>

      <div className="rounded-2xl border border-luminexa-line bg-white p-3 shadow-lx-soft">
        <GigCategoryFilter value={category} onChange={setCategory} />
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-teal-200 bg-luminexa-mist/60 px-4 py-10 text-center">
          <p className="text-sm text-teal-900">
            No requests on the wall yet. Be the first to post.
          </p>
          <Link
            to={customerGigCreate()}
            className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline"
          >
            Post a request
          </Link>
        </div>
      )}

      {!loading && posts.length > 0 && mineCount > 0 && (
        <p className="text-xs font-medium uppercase tracking-wide text-teal-800">
          Your posts ({mineCount})
        </p>
      )}

      <div className="space-y-3">
        {posts.map((post, idx) => {
          const prev = posts[idx - 1];
          const showOthersHeading =
            idx > 0 && prev?.is_mine && !post.is_mine;
          return (
            <React.Fragment key={post.id}>
              {showOthersHeading && (
                <p className="pt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Community requests
                </p>
              )}
              <GigPostCard
                post={post}
                onClick={() => navigate(customerGigDetail(post.id))}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
