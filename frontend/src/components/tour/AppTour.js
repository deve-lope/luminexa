import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import {
  APP_TOUR_START_EVENT,
  buildAppTourSteps,
  markAppTourComplete,
  queryTourTarget,
  shouldAutoStartAppTour,
} from '../../utils/appTour';

const PAD = 8;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Skippable spotlight walkthrough for new customers and providers.
 * Auto-starts once after profile onboarding; replay via requestAppTour().
 */
export default function AppTour({
  role,
  user,
  orgSlug = '',
  includeGigs = true,
  enabled = true,
}) {
  const userId = user?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState(null);
  const [cardStyle, setCardStyle] = useState({ top: 'auto', bottom: 24, left: 16, right: 16 });

  const steps = useMemo(
    () => buildAppTourSteps(role, { orgSlug, includeGigs }),
    [role, orgSlug, includeGigs]
  );

  const finish = useCallback(() => {
    markAppTourComplete(role, userId);
    setActive(false);
    setStepIndex(0);
    setHole(null);
  }, [role, userId]);

  const start = useCallback(() => {
    if (!enabled || !role || !steps.length) return;
    setStepIndex(0);
    setActive(true);
  }, [enabled, role, steps.length]);

  useEffect(() => {
    if (!enabled || !role || !user) return undefined;
    if (!shouldAutoStartAppTour(role, user)) return undefined;
    const t = window.setTimeout(() => start(), 450);
    return () => window.clearTimeout(t);
  }, [enabled, role, user, start]);

  useEffect(() => {
    const onStart = (event) => {
      const detail = event?.detail || {};
      if (detail.role && detail.role !== role) return;
      start();
    };
    window.addEventListener(APP_TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(APP_TOUR_START_EVENT, onStart);
  }, [role, start]);

  useModalBodyLock(active);

  const step = steps[stepIndex] || null;

  // Navigate to the step’s path when the tour advances.
  useEffect(() => {
    if (!active || !step?.path) return;
    const current = location.pathname.replace(/\/$/, '') || '/';
    const target = step.path.replace(/\/$/, '') || '/';
    if (current !== target) {
      navigate(step.path, { replace: true });
    }
  }, [active, step?.path, step?.id, navigate, location.pathname]);

  const measure = useCallback(() => {
    if (!active || !step) return;
    const el = step.target ? queryTourTarget(step.target) : null;
    if (!el) {
      setHole(null);
      setCardStyle({
        top: 'auto',
        bottom: 'max(1.5rem, var(--lx-sab))',
        left: 16,
        right: 16,
        maxWidth: 420,
        marginLeft: 'auto',
        marginRight: 'auto',
      });
      return;
    }
    const rect = el.getBoundingClientRect();
    const nextHole = {
      top: Math.max(0, rect.top - PAD),
      left: Math.max(0, rect.left - PAD),
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
    };
    setHole(nextHole);

    const vh = window.innerHeight;
    const spaceBelow = vh - (nextHole.top + nextHole.height);
    const placeAbove = spaceBelow < 220 && nextHole.top > 220;
    const left = clamp(nextHole.left, 12, Math.max(12, window.innerWidth - 340));

    if (placeAbove) {
      setCardStyle({
        top: 'auto',
        bottom: vh - nextHole.top + 12,
        left,
        right: 'auto',
        width: 'min(340px, calc(100vw - 24px))',
        maxWidth: 340,
      });
    } else {
      setCardStyle({
        top: nextHole.top + nextHole.height + 12,
        bottom: 'auto',
        left,
        right: 'auto',
        width: 'min(340px, calc(100vw - 24px))',
        maxWidth: 340,
      });
    }
  }, [active, step]);

  useLayoutEffect(() => {
    if (!active) return undefined;
    measure();
    // Remeasure after route paint / layout settle.
    const t1 = window.setTimeout(measure, 80);
    const t2 = window.setTimeout(measure, 280);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, measure, location.pathname, stepIndex]);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish]);

  if (!active || !step) return null;

  const isLast = stepIndex >= steps.length - 1;
  const progressLabel = `${stepIndex + 1} of ${steps.length}`;

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    if (stepIndex <= 0) return;
    setStepIndex((i) => i - 1);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-tour-title"
    >
      {/* Dim with spotlight hole via box-shadow on a cutout */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {hole ? (
          <div
            className="absolute rounded-2xl ring-2 ring-white/90 transition-all duration-300"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              boxShadow: '0 0 0 9999px rgb(15 23 42 / 0.55)',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-slate-900/55" />
        )}
      </div>

      {/* Block interaction outside the card */}
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss tour backdrop"
        onClick={finish}
        tabIndex={-1}
      />

      <div
        className="absolute z-10 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xl shadow-slate-900/20"
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">
            {progressLabel}
          </p>
          <button
            type="button"
            onClick={finish}
            className="shrink-0 text-sm font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Skip
          </button>
        </div>
        <h2 id="app-tour-title" className="mt-1 text-lg font-bold tracking-tight text-slate-900">
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-slate-600">{step.body}</p>

        <div className="mt-4 flex items-center gap-2">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            onClick={goNext}
            className="min-h-[44px] flex-[1.4] rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm shadow-teal-600/20 hover:bg-teal-700"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
