import React, { useMemo } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { isAndroidApp } from '../../native/capacitorNative';
import { startGuidedTour } from '../../utils/appTour';
import {
  buildProviderTrainingLessons,
  getProviderTrainingLesson,
} from '../../utils/providerTraining';
import { providerTraining, providerTrainingLesson } from '../../utils/providerPaths';

export default function ProviderTrainingPage() {
  const { orgSlug } = useProviderOrg();
  const { lessonId } = useParams();
  const includeGigs = !isAndroidApp();

  if (lessonId) {
    return (
      <TrainingLesson
        orgSlug={orgSlug}
        lessonId={lessonId}
        includeGigs={includeGigs}
      />
    );
  }

  return <TrainingHub orgSlug={orgSlug} includeGigs={includeGigs} />;
}

function TrainingHub({ orgSlug, includeGigs }) {
  const lessons = useMemo(
    () => buildProviderTrainingLessons(orgSlug, { includeGigs }),
    [orgSlug, includeGigs]
  );
  const featured = lessons.filter((l) => l.featured);
  const rest = lessons.filter((l) => !l.featured);

  return (
    <div className="space-y-5">
      <header>
        <p className="lx-eyebrow">Learn</p>
        <h2 className="lx-section-title mt-1">Training</h2>
        <p className="lx-muted mt-2 max-w-xl text-sm leading-relaxed">
          Start with the full walkthrough (service → book → task → reschedule → questions → on my
          way → complete). Then use shorter lessons anytime. Show me highlights where to tap — no
          video, no extra cost.
        </p>
      </header>

      {featured.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-700">
            Start here
          </p>
          <ul className="space-y-2">
            {featured.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  to={providerTrainingLesson(orgSlug, lesson.id)}
                  className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50 to-white px-4 py-3.5 shadow-sm transition hover:border-teal-300 hover:from-teal-50/80"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900">{lesson.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-slate-600">
                      {lesson.summary}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-teal-700" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Topic lessons
        </p>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          {rest.map((lesson) => (
            <li key={lesson.id}>
              <Link
                to={providerTrainingLesson(orgSlug, lesson.id)}
                className="flex min-h-[56px] items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{lesson.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                    {lesson.summary}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-teal-700" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TrainingLesson({ orgSlug, lessonId, includeGigs }) {
  const navigate = useNavigate();
  const lesson = useMemo(
    () => getProviderTrainingLesson(orgSlug, lessonId, { includeGigs }),
    [orgSlug, lessonId, includeGigs]
  );

  if (!lesson) {
    return <Navigate to={providerTraining(orgSlug)} replace />;
  }

  const showMe = () => {
    if (!lesson.spotlightSteps?.length) return;
    startGuidedTour({ role: 'provider', steps: lesson.spotlightSteps });
  };

  const openPage = () => {
    if (lesson.openPath) navigate(lesson.openPath);
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="lx-eyebrow">{lesson.featured ? 'Start here' : 'Training'}</p>
        <h2 className="lx-section-title mt-1">{lesson.title}</h2>
        <p className="lx-muted mt-2 max-w-xl text-sm leading-relaxed">{lesson.summary}</p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        {lesson.spotlightSteps?.length > 0 ? (
          <button type="button" onClick={showMe} className="lx-btn-primary min-h-[44px] flex-1">
            Show me
          </button>
        ) : null}
        {lesson.openPath ? (
          <button
            type="button"
            onClick={openPage}
            className="lx-btn-secondary min-h-[44px] flex-1"
          >
            Open page
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
        {(lesson.sections || []).map((section) => (
          <section
            key={section.heading}
            className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4"
          >
            <h3 className="text-sm font-bold tracking-tight text-slate-900">{section.heading}</h3>
            {section.body ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{section.body}</p>
            ) : null}
            {section.bullets?.length ? (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <Link
        to={providerTraining(orgSlug)}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-teal-700 hover:text-teal-800"
      >
        ← All lessons
      </Link>
    </div>
  );
}
