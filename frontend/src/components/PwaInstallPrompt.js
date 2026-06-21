import React from 'react';
import usePwaInstall from '../hooks/usePwaInstall';

export default function PwaInstallPrompt() {
  const { canInstall, showIosGuide, install, dismiss } = usePwaInstall();

  if (!canInstall && !showIosGuide) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-white/15 bg-luminexa-navy/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-luminexa-accent/20">
              <svg className="h-5 w-5 text-luminexa-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Install Luminexa</p>
              {showIosGuide ? (
                <p className="mt-1 text-xs leading-relaxed text-white/65">
                  Tap{' '}
                  <svg className="inline h-4 w-4 align-text-bottom text-luminexa-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
                  </svg>{' '}
                  Share, then <strong className="text-white/90">Add to Home Screen</strong> for the
                  full app experience.
                </p>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-white/65">
                  Add to your home screen for quick access and a full-screen experience.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {canInstall && (
              <button
                type="button"
                onClick={install}
                className="flex min-h-[40px] flex-1 items-center justify-center rounded-xl bg-luminexa-accent px-4 text-sm font-semibold text-white shadow-lg shadow-luminexa-accent/25 transition hover:bg-violet-600"
              >
                Install
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="flex min-h-[40px] items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-medium text-white/70 transition hover:bg-white/5"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
