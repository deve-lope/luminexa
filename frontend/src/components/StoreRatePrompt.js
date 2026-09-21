import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { isNativeApp } from '../native/capacitorNative';
import { getStoreReviewUrl } from '../utils/storeLinks';
import { openExternalWebsite } from '../utils/openExternalWebsite';
import {
  ensureFirstOpenedAt,
  markStoreRateCompleted,
  markStoreRateDismissed,
  shouldShowStoreRatePrompt,
} from '../utils/storeRatePrompt';

const SHOW_DELAY_MS = 2500;

/**
 * After ~1 week in the Capacitor Play / iOS app, ask to rate Luminexa on the store.
 * Skipped entirely for browser / webview users.
 */
export default function StoreRatePrompt() {
  const [visible, setVisible] = useState(false);
  const [storeUrl, setStoreUrl] = useState(null);
  const [platform, setPlatform] = useState('');

  useEffect(() => {
    if (!isNativeApp()) return undefined;

    ensureFirstOpenedAt();
    let nativePlatform = '';
    try {
      nativePlatform = Capacitor.getPlatform();
    } catch {
      return undefined;
    }
    const url = getStoreReviewUrl(nativePlatform);
    if (!url) return undefined;

    if (!shouldShowStoreRatePrompt({ isNative: true, storeUrl: url })) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (shouldShowStoreRatePrompt({ isNative: true, storeUrl: url })) {
        setPlatform(nativePlatform);
        setStoreUrl(url);
        setVisible(true);
      }
    }, SHOW_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  if (!visible || !storeUrl) return null;

  const onRate = async () => {
    markStoreRateCompleted();
    setVisible(false);
    await openExternalWebsite(storeUrl);
  };

  const onDismiss = () => {
    markStoreRateDismissed();
    setVisible(false);
  };

  const cta = platform === 'ios' ? 'Rate on the App Store' : 'Rate on Google Play';

  return (
    <div className="lx-pwa-install-prompt lx-fixed-above-tabs p-3 px-safe sm:p-4 lg:bottom-6">
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-lx-elevated backdrop-blur-xl">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 ring-1 ring-teal-100/60">
              <svg
                className="h-5 w-5 text-teal-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-tight text-slate-900">
                Enjoying Luminexa?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                A quick store rating helps other people find us. Takes a few seconds.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={onRate}
              className="lx-btn-primary flex min-h-[40px] flex-1 items-center justify-center"
            >
              {cta}
            </button>
            <button
              type="button"
              onClick={onDismiss}
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
