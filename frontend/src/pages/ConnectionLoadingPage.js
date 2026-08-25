import React from 'react';

/** Shown while the app is waiting on the API for a short grace period. */
export default function ConnectionLoadingPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-teal-50/40 to-slate-100 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-800">Luminexa</p>
      <div
        className="mt-8 h-10 w-10 animate-spin rounded-full border-[3px] border-teal-200 border-t-teal-800"
        aria-hidden
      />
      <p className="mt-5 text-base font-medium text-slate-700">Loading…</p>
      <p className="mt-1 text-sm text-slate-500">Connecting to Luminexa</p>
    </div>
  );
}
