import React, { useState } from 'react';

const DIMENSIONS = [
  { key: 'communication', label: 'Communication' },
  { key: 'price', label: 'Price' },
  { key: 'punctual', label: 'Punctual' },
  { key: 'quality', label: 'Quality of work' },
];

function StarPicker({ value, onChange, label }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`min-h-[40px] min-w-[40px] rounded-lg text-xl transition ${
              value >= star
                ? 'text-amber-400'
                : 'text-slate-300 hover:text-amber-200'
            }`}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ServiceRatingForm({ onSubmit, submitting }) {
  const [ratings, setRatings] = useState({
    communication: 0,
    price: 0,
    punctual: 0,
    quality: 0,
  });
  const [comment, setComment] = useState('');

  const allRated = DIMENSIONS.every((d) => ratings[d.key] >= 1);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!allRated) return;
    onSubmit({ ...ratings, comment: comment.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">
        Rate your experience on each category (1–5 stars).
      </p>
      {DIMENSIONS.map((dim) => (
        <StarPicker
          key={dim.key}
          label={dim.label}
          value={ratings[dim.key]}
          onChange={(v) => setRatings((r) => ({ ...r, [dim.key]: v }))}
        />
      ))}
      <label className="block text-sm text-slate-600">
        Comment (optional)
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Share more about your experience…"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={!allRated || submitting}
        className="min-h-[44px] w-full rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit rating'}
      </button>
    </form>
  );
}
