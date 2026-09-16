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

export default function GigCommentThread({ comments = [], loading = false }) {
  if (loading) {
    return <p className="text-sm text-slate-500">Loading comments…</p>;
  }
  if (!comments.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        No comments yet. Be the first to ask a question.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <div
          key={c.id}
          className={`rounded-lg border px-3 py-2 ${
            c.is_customer_comment
              ? 'border-sky-100 bg-sky-50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <strong className="text-slate-800">{c.author_name}</strong>
            <span className="rounded-full bg-white/80 px-2 py-0.5">
              {c.is_customer_comment
                ? 'Customer'
                : `Provider${c.organization_name ? `: ${c.organization_name}` : ''}`}
            </span>
            <span>{timeAgo(c.created_at)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-800">{c.body}</p>
        </div>
      ))}
    </div>
  );
}
