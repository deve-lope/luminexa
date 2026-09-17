import React from 'react';

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function initial(name) {
  const s = (name || '').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
}

export default function GigCommentThread({ comments = [], loading = false }) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading comments…</p>;
  }
  if (!comments.length) {
    return (
      <div className="gig-empty-board py-8">
        <p className="text-sm text-slate-600">No comments yet. Be the first to ask a question.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((c) => {
        const isCustomer = !!c.is_customer_comment;
        return (
          <div key={c.id} className="gig-comment">
            <div
              className={`gig-comment-avatar ${
                isCustomer ? 'gig-comment-avatar--customer' : 'gig-comment-avatar--provider'
              }`}
              aria-hidden
            >
              {initial(c.author_name)}
            </div>
            <div
              className={`gig-comment-bubble ${
                isCustomer ? 'gig-comment-bubble--customer' : 'gig-comment-bubble--provider'
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <strong className="text-slate-800">{c.author_name}</strong>
                <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium">
                  {isCustomer
                    ? 'Customer'
                    : `Provider${c.organization_name ? `: ${c.organization_name}` : ''}`}
                </span>
                <span>{timeAgo(c.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{c.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
