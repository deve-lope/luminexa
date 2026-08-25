import React from 'react';

function errorText(error) {
  if (!error) return '';
  return typeof error === 'string' ? error : error.message || '';
}

function shouldOfferGpsRetry(error) {
  const text = errorText(error).toLowerCase();
  return text.includes('timed out');
}

/**
 * In-app prompt when GPS fails. Retry stays a tap so the OS can show Allow.
 * If this app build cannot use GPS, only offer Enter address (no flicker loop).
 */
export default function LocationEnablePrompt({
  error,
  locating = false,
  onRetry,
  onEnterAddress,
  retryLabel = 'Turn on location',
}) {
  if (!error) return null;
  const text = errorText(error);
  const showRetry = Boolean(onRetry) && shouldOfferGpsRetry(error);

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
      <p className="text-sm font-semibold text-teal-950">Turn on location</p>
      <p className="mt-1 text-sm leading-snug text-teal-900/80">{text}</p>
      <div className="mt-3 flex flex-col gap-2">
        {showRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={locating}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-luminexa-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {locating ? 'Asking your phone…' : retryLabel}
          </button>
        )}
        {onEnterAddress && (
          <button
            type="button"
            onClick={onEnterAddress}
            disabled={locating}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-teal-200 bg-white px-4 text-sm font-semibold text-teal-900 disabled:opacity-60"
          >
            Enter address
          </button>
        )}
      </div>
    </div>
  );
}
