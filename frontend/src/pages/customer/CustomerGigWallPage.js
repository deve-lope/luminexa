import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

  const { mine, others } = useMemo(() => {
    const mineList = [];
    const otherList = [];
    posts.forEach((p) => {
      if (p.is_mine) mineList.push(p);
      else otherList.push(p);
    });
    return { mine: mineList, others: otherList };
  }, [posts]);

  return (
    <div className="gig-wall-page">
      <div className="gig-wall-page__inner space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="lx-eyebrow">Community board</p>
            <h1 className="gig-wall-page__title mt-0.5 text-xl font-bold tracking-tight">
              Gig wall
            </h1>
            <p className="gig-wall-page__lede mt-0.5 text-sm">
              Help requests pinned for providers nearby. Yours stay on top.
            </p>
          </div>
          <Link to={customerGigCreate()} className="lx-btn-primary shrink-0 px-4 py-2 text-sm">
            Post a request
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
              Nothing pinned yet. Be the first to post a request.
            </p>
            <Link
              to={customerGigCreate()}
              className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline"
            >
              Post a request
            </Link>
          </div>
        )}

        {!loading && mine.length > 0 && (
          <>
            <p className="gig-board-label">Your posts ({mine.length})</p>
            <div className="gig-pin-board">
              {mine.map((post, idx) => (
                <GigPostCard
                  key={post.id}
                  post={post}
                  index={idx}
                  onClick={() => navigate(customerGigDetail(post.id))}
                />
              ))}
            </div>
          </>
        )}

        {!loading && others.length > 0 && (
          <>
            <p className={`gig-board-label${mine.length > 0 ? ' pt-4' : ''}`}>
              Community requests
            </p>
            <div className="gig-pin-board">
              {others.map((post, idx) => (
                <GigPostCard
                  key={post.id}
                  post={post}
                  index={mine.length + idx}
                  onClick={() => navigate(customerGigDetail(post.id))}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
