import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import SeoHead from '../components/SeoHead';
import citySeo from '../seo/cities.json';

/**
 * Design plan (frontend-design + Luminexa brand):
 * Color: canvas #f6f7f5 · teal ink #042f2e · teal #0f766e · amber CTA #f59e0b · muted #475569
 * Type: Manrope (site face) — bold display, medium body
 * Layout: hero = promise + keywords + phone demo; scroll = problem→solve feature list; then real comparison table
 * Principles: no duplicate keyword dump; no SaaS card grid; Demo stays the loud ask
 */

const DEFAULT_FEATURES = [
  {
    name: 'Arrival tracking',
    solves:
      'Customers see when you’re close — no standing outside waiting for a call pickup.',
  },
  {
    name: 'Messaging',
    solves: 'Job chat stays on the booking. Less “which text thread was that?” chaos.',
  },
  {
    name: 'Rescheduling',
    solves: 'Move a slot without starting over or losing the job notes.',
  },
  {
    name: 'Job tasks',
    solves: 'Remind yourself what to bring or do on-site so nothing gets left in the van.',
  },
  {
    name: 'Invoices',
    solves: 'Send a clear bill from the job — no spreadsheet after every driveway.',
  },
  {
    name: 'Stripe payments',
    solves:
      'Take card on the invoice. Less chasing cash, less Interac “did it go through?” stress.',
  },
  {
    name: 'Retention reminders',
    solves: 'Nudge past customers to rebook so repeat work doesn’t fall through the cracks.',
  },
  {
    name: 'Growth & profit analytics',
    solves: 'See cash, receivables, and job profit — know what actually made money.',
  },
  {
    name: 'Open calendar',
    solves: 'Publish real open times from your phone between stops.',
  },
  {
    name: 'Booking link',
    solves: 'One shareable link for Instagram and texts — clients book themselves.',
  },
  {
    name: 'Clients',
    solves: 'Keep who you’ve served in one place instead of a contacts graveyard.',
  },
];

const FEATURE_KEYWORDS = DEFAULT_FEATURES.map((f) => f.name);

function FeatureKeywords({ labels = FEATURE_KEYWORDS }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Pro feature keywords">
      {labels.map((label) => (
        <li
          key={label}
          className="rounded-full border border-teal-800/15 bg-teal-950/[0.04] px-3 py-1 text-xs font-medium text-teal-900/80 sm:text-[0.8125rem]"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

function PhoneDemoPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[260px] sm:max-w-[280px]">
      <Link
        to="/demo/provider"
        className="group relative block focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-luminexa-canvas"
        aria-label="Try the live provider demo"
      >
        <div className="aspect-[9/19.5] rounded-[2.4rem] border-[3px] border-teal-950 bg-teal-950 p-[0.55rem] shadow-2xl shadow-teal-950/40 transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-teal-900/50 group-active:scale-[0.99]">
          <div className="relative flex h-full flex-col overflow-hidden rounded-[1.95rem] bg-luminexa-canvas">
            <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-teal-950" aria-hidden />
            <div className="flex items-center justify-between bg-white px-3 pb-2 pt-8">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
                  Today
                </p>
                <p className="text-sm font-bold text-slate-900">Rideau Mobile</p>
              </div>
              <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path
                    d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M10 20a2 2 0 004 0" strokeLinecap="round" />
                </svg>
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 bg-luminexa-canvas px-3 pb-5 pt-2">
              <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 p-3 text-white shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-100">
                  Up next
                </p>
                <p className="mt-0.5 text-sm font-bold">Exterior wash · Alex</p>
                <p className="text-xs text-teal-50/90">10:00 · Elgin St driveway</p>
              </div>
              <div className="rounded-xl border border-teal-900/10 bg-white px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  Tasks
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-800">
                  Bring microfiber towels
                </p>
              </div>
              <div className="rounded-xl border border-teal-900/10 bg-white px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Later today
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-800">
                  Interior detail · Sam
                </p>
              </div>
              <div className="rounded-xl border border-teal-900/10 bg-white px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Message
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-800">
                  Alex: Gate code is 4421
                </p>
              </div>
              <div className="mt-auto rounded-xl border border-dashed border-amber-400/70 bg-amber-50 px-3 py-3.5 text-center">
                <p className="text-sm font-bold text-amber-950">Tap to open live demo</p>
                <p className="mt-0.5 text-[11px] text-amber-900/75">
                  Explore as if it’s your account
                </p>
              </div>
            </div>
            <span
              className="mx-auto mb-2 h-1 w-24 shrink-0 rounded-full bg-teal-950/25"
              aria-hidden
            />
          </div>
        </div>
      </Link>
    </div>
  );
}

function DemoCtas({ stacked = false }) {
  return (
    <div
      className={
        stacked
          ? 'flex flex-col gap-3'
          : 'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center'
      }
    >
      <Link
        to="/demo/provider"
        className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-amber-500 px-8 text-sm font-bold text-amber-950 shadow-lg shadow-amber-900/20 transition hover:bg-amber-400"
      >
        Try the live demo
      </Link>
      <Link
        to="/register/business"
        className="inline-flex min-h-[44px] items-center justify-center px-2 text-sm font-semibold text-teal-800 underline-offset-2 hover:text-teal-950 hover:underline sm:min-h-[52px]"
      >
        Start free trial
      </Link>
      <Link
        to="/pricing/"
        className="text-center text-sm font-medium text-slate-500 underline-offset-2 hover:text-teal-800 hover:underline sm:text-left"
      >
        See pricing
      </Link>
    </div>
  );
}

function FeatureDetailList({ features, tone = 'light' }) {
  const dark = tone === 'dark';
  return (
    <ul
      className={`divide-y border-y ${
        dark ? 'divide-teal-100/15 border-teal-100/15' : 'divide-teal-900/10 border-teal-900/10'
      }`}
    >
      {features.map((item) => (
        <li
          key={item.name}
          className="grid gap-1 py-5 sm:grid-cols-[minmax(9rem,14rem)_1fr] sm:gap-8 sm:py-6"
        >
          <p
            className={`text-base font-bold tracking-tight sm:text-lg ${
              dark ? 'text-white' : 'text-teal-950'
            }`}
          >
            {item.name}
          </p>
          <p
            className={`max-w-xl text-sm leading-relaxed sm:text-base ${
              dark ? 'text-teal-100/80' : 'text-slate-600'
            }`}
          >
            {item.solves}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ComparisonTable({ comparison }) {
  if (!comparison?.columns?.length || !comparison?.rows?.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-16">
      <h2 className="text-2xl font-extrabold tracking-tight text-teal-950 sm:text-3xl">
        {comparison.caption || 'How Luminexa compares'}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
        Same job: booking and invoices. Different price and depth. Check competitor sites for
        current plans.
      </p>

      <div className="mt-8 overflow-x-auto rounded-xl border border-teal-900/15 bg-white shadow-sm">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-teal-900/15 bg-teal-950 text-teal-50">
              {comparison.columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide first:sticky first:left-0 first:bg-teal-950 sm:px-5 sm:text-sm sm:normal-case sm:tracking-tight"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row, rowIndex) => {
              const isLuminexa = String(row[0] || '')
                .toLowerCase()
                .includes('luminexa');
              return (
                <tr
                  key={row[0]}
                  className={`border-b border-teal-900/10 last:border-b-0 ${
                    isLuminexa
                      ? 'bg-amber-50/90'
                      : rowIndex % 2 === 1
                        ? 'bg-slate-50/80'
                        : 'bg-white'
                  }`}
                >
                  {row.map((cell, i) => {
                    const Tag = i === 0 ? 'th' : 'td';
                    return (
                      <Tag
                        key={`${row[0]}-${i}`}
                        scope={i === 0 ? 'row' : undefined}
                        className={`px-4 py-3.5 align-top sm:px-5 ${
                          i === 0
                            ? `sticky left-0 font-semibold text-teal-950 ${
                                isLuminexa ? 'bg-amber-50' : rowIndex % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                              }`
                            : isLuminexa
                              ? 'font-medium text-teal-950'
                              : 'text-slate-600'
                        }`}
                      >
                        {cell}
                      </Tag>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {comparison.note ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-500 sm:text-sm">{comparison.note}</p>
      ) : null}
      <div className="mt-8">
        <Link
          to="/demo/provider"
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-500 px-7 text-sm font-bold text-amber-950 shadow-md shadow-amber-900/15 transition hover:bg-amber-400"
        >
          Try the live demo
        </Link>
      </div>
    </section>
  );
}

export default function ForNewProvidersPage() {
  const page = citySeo.forNewProviders;
  if (!page) return <Navigate to="/" replace />;
  const canonical = `${citySeo.siteUrl}/for-new-providers/`;
  const features =
    Array.isArray(page.featureDetails) && page.featureDetails.length
      ? page.featureDetails
      : DEFAULT_FEATURES;
  const keywords = page.features || features.map((f) => f.name);

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-luminexa-canvas text-slate-900">
      <SeoHead
        title={page.title}
        description={page.description}
        canonical={canonical}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: page.title,
            url: canonical,
            description: page.description,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: (page.faq || []).map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          },
        ]}
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-b from-teal-950/[0.07] via-teal-700/[0.03] to-transparent"
        aria-hidden
      />

      <header className="sticky top-0 z-30 border-b border-teal-900/10 bg-white/95 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex min-h-[52px] max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-teal-950 md:text-xl">
            Luminexa
          </Link>
          <Link
            to="/register/business"
            className="inline-flex min-h-[48px] shrink-0 items-center rounded-full bg-amber-500 px-5 text-sm font-bold text-amber-950 shadow-sm hover:bg-amber-400 sm:min-h-[52px] sm:px-6 sm:text-base"
          >
            Start free trial
          </Link>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-8 md:px-8 lg:grid-cols-12 lg:items-center lg:gap-12 lg:pb-16 lg:pt-12">
          <div className="lg:col-span-6">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-semibold text-teal-700"
            >
              {page.kicker || 'For providers'}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-2 text-[1.85rem] font-extrabold leading-[1.08] tracking-tight text-teal-950 sm:text-4xl lg:text-[2.75rem] lg:leading-[1.05]"
            >
              {page.h1 || 'Run jobs from your pocket'}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg"
            >
              {page.lead}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.14 }}
              className="mt-6 inline-flex items-baseline gap-2 rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 shadow-sm shadow-amber-900/5"
            >
              <span className="text-3xl font-extrabold tracking-tight text-amber-700 sm:text-4xl">
                $9.99
              </span>
              <span className="text-sm font-semibold text-amber-900/80">
                CAD/mo
                <span className="mt-0.5 block text-xs font-medium text-amber-800/70">
                  after free trial
                </span>
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="mt-6"
            >
              <p className="mb-2.5 text-sm font-medium text-slate-500">Included in Pro</p>
              <FeatureKeywords labels={keywords} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="mt-8 hidden lg:block"
            >
              <DemoCtas />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.55 }}
            className="lg:col-span-6"
          >
            <p className="mb-3 text-center text-sm font-medium text-slate-500 lg:text-left">
              Live demo
            </p>
            <PhoneDemoPreview />
            <div className="mt-8 lg:hidden">
              <DemoCtas stacked />
            </div>
          </motion.div>
        </section>

        {/* Problem → solve features (scroll depth; not a keyword repeat) */}
        <section className="bg-teal-950 py-14 text-teal-50 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <h2 className="max-w-2xl text-2xl font-extrabold tracking-tight text-white sm:text-3xl md:text-[2.1rem]">
              Problems Pro actually solves
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-teal-100/75">
              Each tool is there for a real headache on the job — not a feature checklist for
              show.
            </p>
            <div className="mt-10">
              <FeatureDetailList features={features} tone="dark" />
            </div>
            <div className="mt-10">
              <Link
                to="/demo/provider"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-500 px-7 text-sm font-bold text-amber-950 shadow-md shadow-black/20 transition hover:bg-amber-400"
              >
                Try the live demo
              </Link>
            </div>
          </div>
        </section>

        <ComparisonTable comparison={page.comparison} />

        {(page.faq || []).length > 0 && (
          <section className="border-t border-teal-900/10 bg-white/70 py-14 md:py-16">
            <div className="mx-auto max-w-3xl px-4 md:px-8">
              <h2 className="text-xl font-extrabold tracking-tight text-teal-950 sm:text-2xl">
                Questions
              </h2>
              <div className="mt-6 space-y-3">
                {page.faq.map((item) => (
                  <details
                    key={item.q}
                    className="rounded-xl border border-teal-900/10 bg-white px-4 py-3"
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                      {item.q}
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
                  </details>
                ))}
              </div>
              <p className="mt-8 text-center text-sm text-slate-500">
                See{' '}
                <Link to="/pricing/" className="font-semibold text-teal-800 hover:underline">
                  pricing
                </Link>
                {' · '}
                <Link to="/alternatives/" className="font-semibold text-teal-800 hover:underline">
                  alternatives
                </Link>
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
