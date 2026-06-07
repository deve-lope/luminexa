import React from 'react';

/**
 * Full-screen saving indicator with spinner (blocks interaction while active).
 */
export default function SavingOverlay({ message = 'Saving…', submessage }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-4 flex max-w-sm flex-col items-center rounded-2xl bg-white px-10 py-8 shadow-2xl ring-1 ring-slate-200/80">
        <div className="relative h-14 w-14" aria-hidden>
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-violet-100 border-t-luminexa-accent" />
          <div
            className="absolute inset-2 animate-spin rounded-full border-4 border-transparent border-b-violet-300"
            style={{ animationDirection: 'reverse', animationDuration: '0.9s' }}
          />
        </div>
        <p className="mt-5 text-center text-base font-semibold text-slate-900">{message}</p>
        {submessage && (
          <p className="mt-1 text-center text-sm text-slate-500">{submessage}</p>
        )}
      </div>
    </div>
  );
}
