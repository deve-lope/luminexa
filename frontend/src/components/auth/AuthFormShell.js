import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import BackButton from '../navigation/BackButton';

/**
 * Shared auth shell (login, register, reset, verify).
 * Calm canvas + brand signal — suitable as a first-visit landing page.
 */
export default function AuthFormShell({
  title,
  subtitle,
  children,
  backTo = '/',
  footer = null,
  preferFallbackBack = false,
  /** Short line under the brand wordmark (first-visit context). */
  brandLine = 'Local services. Real open times.',
  /** When set, shows a brand panel beside the form on large screens. */
  panel = null,
}) {
  const hasPanel = Boolean(panel?.headline);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-luminexa-canvas text-luminexa-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-lx-hero-soft opacity-90"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-700/20 to-transparent"
      />

      <div
        className={`relative z-10 mx-auto flex min-h-[100dvh] w-full flex-col justify-center px-4 py-8 sm:px-6 sm:py-12 ${
          hasPanel ? 'max-w-5xl lg:py-16' : 'max-w-md'
        }`}
      >
        <div className={`mb-8 flex items-center justify-between ${hasPanel ? 'lg:mb-10' : ''}`}>
          <Link
            to="/"
            className="text-2xl font-extrabold tracking-tight text-luminexa-ink sm:text-[1.65rem]"
          >
            Luminexa
          </Link>
          <BackButton
            fallback={backTo}
            preferFallback={preferFallbackBack}
            className="text-sm font-medium text-slate-500 hover:text-luminexa-ink"
          >
            ← Back
          </BackButton>
        </div>

        <div
          className={
            hasPanel
              ? 'grid items-stretch gap-8 lg:grid-cols-2 lg:gap-12 lg:items-center'
              : ''
          }
        >
          {hasPanel && (
            <motion.aside
              className="hidden lg:block"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/70">
                {brandLine}
              </p>
              <h2 className="mt-4 max-w-md text-3xl font-extrabold leading-tight tracking-tight text-luminexa-ink xl:text-4xl">
                {panel.headline}
              </h2>
              {panel.support && (
                <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-600">
                  {panel.support}
                </p>
              )}
              {Array.isArray(panel.points) && panel.points.length > 0 && (
                <ul className="mt-8 space-y-3">
                  {panel.points.map((point) => (
                    <li
                      key={point}
                      className="flex gap-3 text-sm leading-snug text-slate-700"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-luminexa-accent"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              )}
            </motion.aside>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: hasPanel ? 0.08 : 0 }}
          >
            {!hasPanel && brandLine && (
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/70">
                {brandLine}
              </p>
            )}
            {hasPanel && (
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800/70 lg:hidden">
                {brandLine}
              </p>
            )}

            <div className="rounded-2xl border border-luminexa-line bg-white p-6 shadow-lx-soft sm:p-8">
              <h1 className="text-2xl font-extrabold tracking-tight text-luminexa-ink sm:text-[1.75rem]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>
              )}
              <div className="mt-6">{children}</div>
            </div>

            {footer && (
              <div className="mt-6 text-sm text-slate-600">{footer}</div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
