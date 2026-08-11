import React, { useState } from 'react';
import { useApiHealth } from '../contexts/ApiHealthContext';

export default function MaintenancePage() {
  const { retry } = useApiHealth();
  const [busy, setBusy] = useState(false);

  const onRetry = async () => {
    setBusy(true);
    try {
      const ok = await retry();
      if (!ok) {
        /* stay on this page */
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-teal-50/40 to-slate-100 px-6 text-center">
      <div className="w-full max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-800">Luminexa</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          Site under maintenance
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          We&apos;re temporarily unavailable. Sorry for the inconvenience — please try again in a
          few minutes.
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={busy}
          className="mt-8 min-h-[48px] w-full rounded-2xl bg-teal-800 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-900 disabled:opacity-60"
        >
          {busy ? 'Checking…' : 'Try again'}
        </button>
      </div>
    </div>
  );
}
