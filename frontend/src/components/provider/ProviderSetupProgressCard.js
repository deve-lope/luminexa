import React from 'react';
import { Link } from 'react-router-dom';
import {
  markProviderSetupWizardDone,
  providerResumeSetupPath,
} from '../../utils/profileSetup';

/**
 * Setup % + colored checklist (incomplete = amber, done = teal).
 */
export default function ProviderSetupProgressCard({
  orgSlug,
  checklist,
  onDismiss,
  className = '',
}) {
  if (!checklist || checklist.complete || !checklist.items?.length) return null;

  const { percent, doneCount, total, items } = checklist;

  return (
    <div
      className={`rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-slate-800 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-teal-950">Finish setting up your business</p>
          <p className="mt-1 text-teal-900/80">
            {doneCount} of {total} required steps done · {percent}%
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-teal-100">
            <div
              className="h-full rounded-full bg-teal-600 transition-all"
              style={{ width: `${Math.max(8, percent)}%` }}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={() => {
              markProviderSetupWizardDone(orgSlug);
              onDismiss();
            }}
            className="shrink-0 text-xs font-semibold text-teal-800 hover:text-teal-950"
          >
            Dismiss
          </button>
        )}
      </div>

      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={item.done ? item.to : item.setupTo || item.to}
              className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 ring-1 transition ${
                item.done
                  ? 'bg-teal-100/80 text-teal-950 ring-teal-200'
                  : 'bg-amber-50 text-amber-950 ring-amber-200 hover:bg-amber-100/80'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  item.done ? 'bg-teal-600 text-white' : 'bg-amber-400 text-amber-950'
                }`}
                aria-hidden
              >
                {item.done ? '✓' : '!'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {item.label}
                  {item.optional ? (
                    <span className="ml-1 text-xs font-normal opacity-70">(optional)</span>
                  ) : null}
                </span>
                <span className="block text-xs opacity-80">{item.hint}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold opacity-70">
                {item.done ? 'Done' : 'Set up'}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <Link
          to={providerResumeSetupPath(orgSlug)}
          className="inline-flex min-h-[40px] items-center rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white"
        >
          Continue setup
        </Link>
      </div>
    </div>
  );
}
