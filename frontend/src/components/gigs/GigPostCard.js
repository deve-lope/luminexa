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

function statusLabel(status, offerNoun) {
  if (status === 'open') return 'Open';
  if (status === 'quoted') return offerNoun === 'bid' ? 'Has bids' : 'Quoted';
  if (status === 'accepted') return 'Accepted';
  if (status === 'closed') return 'Closed';
  return status || '';
}

export default function GigPostCard({
  post,
  onClick,
  showDistance = false,
  distance,
  offerNoun = 'quote',
}) {
  const location = [post.location_city, post.location_state].filter(Boolean).join(', ');
  const excerpt = (post.description || '').trim();
  const quoteCount = Number(post.quote_count) || 0;
  const quoteLabel =
    quoteCount === 1 ? `1 ${offerNoun}` : `${quoteCount} ${offerNoun}s`;
  const isMine = !!post.is_mine;
  const meta = [
    post.category_name,
    !isMine ? post.customer_name : null,
    location,
    timeAgo(post.created_at),
    quoteLabel,
    showDistance && distance != null ? `${distance} mi` : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`lx-card-interactive w-full p-4 text-left ${
        isMine ? 'ring-1 ring-teal-100' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-slate-900">
          {post.title}
        </h3>
        <span className="shrink-0 rounded-full bg-luminexa-mist px-2 py-0.5 text-[11px] font-semibold text-teal-800">
          {statusLabel(post.status, offerNoun)}
        </span>
      </div>
      {isMine && (
        <span className="mt-1.5 inline-flex rounded-full bg-teal-700 px-2 py-0.5 text-[11px] font-semibold text-white">
          Yours
        </span>
      )}
      {excerpt && (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">{excerpt}</p>
      )}
      {meta.length > 0 && (
        <p className="mt-2 truncate text-xs text-slate-500">{meta.join(' · ')}</p>
      )}
    </button>
  );
}
