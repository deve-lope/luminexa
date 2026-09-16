import React from 'react';

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function GigPostCard({ post, onClick, showDistance = false, distance }) {
  const location = [post.location_city, post.location_state].filter(Boolean).join(', ');
  const excerpt = (post.description || '').slice(0, 150);
  const quoteLabel =
    post.quote_count > 0
      ? `${post.quote_count} quote${post.quote_count === 1 ? '' : 's'}`
      : 'No quotes yet';
  const isMine = !!post.is_mine;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border bg-white p-4 text-left shadow-lx-soft transition hover:shadow-md ${
        isMine
          ? 'border-teal-300 ring-1 ring-teal-100'
          : 'border-luminexa-line hover:border-teal-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-luminexa-ink">{post.title}</h3>
            {isMine && (
              <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[11px] font-semibold text-white">
                Yours
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {excerpt}
            {(post.description || '').length > 150 ? '…' : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {post.category_name && (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 font-medium text-teal-800">
                {post.category_name}
              </span>
            )}
            {!isMine && post.customer_name && (
              <span>{post.customer_name}</span>
            )}
            {location && <span>{location}</span>}
            <span>{timeAgo(post.created_at)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <span className="rounded-full bg-luminexa-mist px-2 py-0.5 font-medium text-teal-800">
            {post.status}
          </span>
          <span className="text-slate-600">{quoteLabel}</span>
          {showDistance && distance != null && (
            <span className="text-slate-500">{distance} mi</span>
          )}
        </div>
      </div>
    </button>
  );
}
