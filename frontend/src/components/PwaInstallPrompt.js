import React from 'react';
import usePwaInstall from '../hooks/usePwaInstall';

export default function PwaInstallPrompt() {
  const { canInstall, storeUrl, dismiss } = usePwaInstall();

  if (!canInstall || !storeUrl) return null;
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) return null;

  return (
    <div className="lx-pwa-install-prompt lx-fixed-above-tabs p-3 px-safe sm:p-4 lg:bottom-6">
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-lx-elevated backdrop-blur-xl">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 ring-1 ring-violet-100/60">
              <svg className="h-5 w-5 text-luminexa-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-tight text-slate-900">Get the Luminexa app</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Install the latest version from Google Play. Do not add this site to your home
                screen — that installs an older web copy.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="lx-btn-primary flex min-h-[40px] flex-1 items-center justify-center"
            >
              Open Play Store
            </a>
            <button
              type="button"
              onClick={dismiss}
              className="lx-btn-ghost min-h-[40px] text-slate-600"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
