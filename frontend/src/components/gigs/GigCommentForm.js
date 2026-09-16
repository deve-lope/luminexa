import React, { useState } from 'react';

export default function GigCommentForm({ onSubmit, disabled = false }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) {
      setError('Write a comment first.');
      return;
    }
    if (text.length > 1000) {
      setError('Comment must be 1000 characters or fewer.');
      return;
    }
    setError('');
    try {
      await onSubmit?.(text);
      setBody('');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not post comment.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ask a question or add a comment…"
        maxLength={1000}
        rows={3}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{body.length}/1000</span>
        <button
          type="submit"
          disabled={disabled || !body.trim()}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Post comment
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
