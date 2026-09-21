import React from 'react';

const EXCERPT_PREVIEW_CHARS = 96;

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

function tiltClass(id) {
  const n = Number(id) || 0;
  const variants = ['gig-pin-note--tilt-a', 'gig-pin-note--tilt-b', 'gig-pin-note--tilt-c'];
  return variants[Math.abs(n) % 3];
}

function toneClass(id) {
  const n = Number(id) || 0;
  const tones = [
    'gig-pin-note--tone-mint',
    'gig-pin-note--tone-mist',
    'gig-pin-note--tone-sky',
    'gig-pin-note--tone-sage',
    'gig-pin-note--tone-blush',
  ];
  return tones[Math.abs(n) % tones.length];
}

function truncateText(text, maxChars) {
  if (!text || text.length <= maxChars) {
    return { preview: text || '', truncated: false };
  }
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  const preview = (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
  return { preview: `${preview}…`, truncated: true };
}

export default function GigPostCard({
  post,
  onClick,
  showDistance = false,
  distance,
  index = 0,
}) {
  const location = [post.location_city, post.location_state].filter(Boolean).join(', ');
  const excerpt = (post.description || '').trim();
  const { preview: excerptPreview, truncated: excerptTruncated } = truncateText(
    excerpt,
    EXCERPT_PREVIEW_CHARS
  );
  const titleRaw = (post.title || '').trim();
  const { preview: titlePreview, truncated: titleTruncated } = truncateText(titleRaw, 64);
  const bidCount = Number(post.quote_count) || 0;
  const bidLabel = bidCount === 1 ? '1 bid' : `${bidCount} bids`;
  const isMine = !!post.is_mine;
  const photoCount = Array.isArray(post.images) ? post.images.length : 0;
  const photoLabel =
    photoCount === 1 ? '1 photo' : photoCount > 1 ? `${photoCount} photos` : null;
  const ago = timeAgo(post.created_at);
  const showSeeMore = excerptTruncated || titleTruncated || excerpt.length > EXCERPT_PREVIEW_CHARS;

  const chips = [
    post.category_name,
    location ? `📍 ${location}` : null,
    ago || null,
    bidLabel,
    photoLabel,
    showDistance && distance != null ? `${distance} mi` : null,
    !isMine && post.customer_name ? post.customer_name : null,
  ].filter(Boolean);

  return (
    <div className="gig-pin-note-enter px-0.5 py-1" style={{ '--i': index }}>
      <button
        type="button"
        onClick={onClick}
        className={`gig-pin-note ${tiltClass(post.id)} ${toneClass(post.id)}${
          isMine ? ' gig-pin-note--mine' : ''
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {isMine && (
                <span className="mb-1.5 inline-flex rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Yours
                </span>
              )}
              <h3 className="text-[0.95rem] font-bold leading-snug tracking-tight text-slate-900 line-clamp-2 sm:text-base">
                {titlePreview}
              </h3>
            </div>
            <span className={`gig-pin-stamp shrink-0 ${statusStampClass(post.status)}`}>
              {statusLabel(post.status)}
            </span>
          </div>

          {excerptPreview && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-slate-600">
              {excerptPreview}
            </p>
          )}

          {showSeeMore && <span className="gig-pin-see-more">See more</span>}

          {chips.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1 pt-2">
              {chips.slice(0, 4).map((chip, i) => (
                <span key={`${i}-${chip}`} className="gig-pin-chip">
                  <span className="truncate">{chip}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
