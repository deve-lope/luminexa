import React, { useState } from 'react';
import {
  LOCATION_ERROR,
  canOpenLocationSettings,
  classifyLocationError,
  locationErrorTitle,
  locationSettingsSteps,
  openLocationSettings,
} from '../../utils/geolocationSupport';

function errorText(error) {
  if (!error) return '';
  return typeof error === 'string' ? error : error.message || '';
}

/**
 * In-app prompt when GPS fails. Retry stays a tap so the OS can show Allow —
 * a blocked permission never re-prompts, so we also show the settings path for
 * that device. Only an app build without the GPS plugin has no retry.
 */
export default function LocationEnablePrompt({
  error,
  errorKind = null,
  locating = false,
  onRetry,
  onEnterAddress,
  retryLabel = 'Try again',
}) {
  const [stepsToggled, setStepsToggled] = useState(null);

  if (!error) return null;

  const text = errorText(error);
  const kind = errorKind || classifyLocationError(error) || LOCATION_ERROR.BLOCKED;
  const canRetry = Boolean(onRetry) && kind !== LOCATION_ERROR.APP_OUTDATED;
  const needsSettings = kind === LOCATION_ERROR.BLOCKED || kind === LOCATION_ERROR.OFF;
  const showSettingsButton = needsSettings && canOpenLocationSettings();
  const steps = kind === LOCATION_ERROR.APP_OUTDATED ? [] : locationSettingsSteps(kind);
  // The OS will not ask again in these states, so lead with the fix. When we can
  // jump straight to the settings screen, the written steps are just a backup.
  const stepsOpen = stepsToggled ?? (needsSettings && !showSettingsButton);

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
      <p className="text-sm font-semibold text-teal-950">{locationErrorTitle(kind)}</p>
      <p className="mt-1 text-sm leading-snug text-teal-900/80">{text}</p>

      {steps.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setStepsToggled(!stepsOpen)}
            className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
          >
            {stepsOpen ? 'Hide steps' : 'How do I turn it on?'}
          </button>
          {stepsOpen && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-snug text-teal-900/80">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={locating}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-luminexa-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {locating ? 'Asking your phone…' : retryLabel}
          </button>
        )}
        {showSettingsButton && (
          <button
            type="button"
            onClick={() => openLocationSettings(kind)}
            disabled={locating}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-teal-300 bg-white px-4 text-sm font-semibold text-teal-900 disabled:opacity-60"
          >
            Open settings
          </button>
        )}
        {onEnterAddress && (
          <button
            type="button"
            onClick={onEnterAddress}
            disabled={locating}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-teal-200 bg-white px-4 text-sm font-semibold text-teal-900 disabled:opacity-60"
          >
            Enter address instead
          </button>
        )}
      </div>
    </div>
  );
}
