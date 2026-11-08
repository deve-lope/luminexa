import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SeoHead from '../components/SeoHead';
import { citySeo } from '../seo/citySeo';

const BENEFITS = [
  'See prices or request a quote before you book',
  'Pick a real open time — less phone tag',
  'Message the provider and track the job in one place',
];

function PhoneBrowsePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[320px] sm:max-w-[340px]">
      <Link
        to="/services"
        className="group relative block focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-luminexa-canvas"
        aria-label="Browse services nearby"
      >
        <div className="rounded-[2.25rem] border-[3px] border-teal-950/90 bg-teal-950 p-2 shadow-2xl shadow-teal-950/40 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-teal-900/50 group-active:scale-[0.99]">
          <div className="overflow-hidden rounded-[1.85rem] bg-luminexa-canvas">
            <div className="bg-white px-4 pb-2 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
                Near you
              </p>
              <p className="text-sm font-bold text-slate-900">Find help</p>
            </div>
            <div className="space-y-2 bg-luminexa-canvas px-3 pb-4 pt-2">
              <div className="rounded-2xl border border-teal-900/10 bg-white p-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                  Snow removal
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">Rideau Mobile</p>
                <p className="text-xs text-slate-600">From $45 · open today 2:00</p>
              </div>
              <div className="rounded-2xl border border-teal-900/10 bg-white p-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                  Car detailing
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">Elgin Detail Co</p>
                <p className="text-xs text-slate-600">Quote on request · tomorrow</p>
              </div>
              <div className="rounded-xl border border-dashed border-teal-500/50 bg-teal-50 px-3 py-3 text-center">
                <p className="text-sm font-bold text-teal-900">Tap to browse live</p>
                <p className="mt-0.5 text-[11px] text-teal-800/80">See real providers near you</p>
              </div>
            </div>
          </div>
        </div>
        <span className="mx-auto mt-3 block h-1 w-16 rounded-full bg-teal-950/80" aria-hidden />
      </Link>
    </div>
  );
}

export default function ForCustomersPage() {
  const page = citySeo.forCustomers || {};
  const canonical = `${citySeo.siteUrl}/for-customers/`;
  const title = page.title || 'Book local services free | Luminexa for customers';
  const description =
    page.description ||
    'Browse local providers, see prices or request a quote, pick an open time, and message about the job — free for customers on Luminexa.';
  const benefits = page.benefits?.length ? page.benefits : BENEFITS;

  return (
    <div className="min-h-[100dvh] bg-luminexa-canvas text-slate-900">
      <SeoHead
        title={title}
        description={description}
        canonical={canonical}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: title,
          url: canonical,
          description,
        }}
      />

      <header className="sticky top-0 z-30 border-b border-teal-900/10 bg-white/95 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex min-h-[52px] max-w-lg items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-teal-950">
            Luminexa
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/services"
              className="inline-flex min-h-[44px] items-center rounded-full bg-teal-600 px-3.5 text-xs font-bold text-white hover:bg-teal-700 sm:text-sm"
            >
              Browse
            </Link>
            <Link
              to="/register"
              className="inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-teal-800 hover:text-teal-950"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700"
        >
          {page.kicker || 'For customers'}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-3 text-[1.85rem] font-extrabold leading-[1.1] tracking-tight text-teal-950 sm:text-4xl"
        >
          {page.h1 || 'Book help without the phone tag'}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-3 text-base leading-relaxed text-slate-600"
        >
          {page.lead ||
            'Snow, detailing, cleaning, and more — see what’s nearby, pick an open time, and chat about the job. Customer accounts are free.'}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.14 }}
          className="mt-5 inline-flex items-baseline gap-2 rounded-2xl border border-teal-300/80 bg-teal-50 px-4 py-3 shadow-sm shadow-teal-900/5"
        >
          <span className="text-3xl font-extrabold tracking-tight text-teal-800 sm:text-4xl">
            Free
          </span>
          <span className="text-sm font-semibold text-teal-900/80">
            to book
            <span className="mt-0.5 block text-xs font-medium text-teal-800/70">
              no subscription for customers
            </span>
          </span>
        </motion.div>

        <ul className="mt-6 space-y-2.5">
          {benefits.map((line, i) => (
            <motion.li
              key={line}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.16 + i * 0.05 }}
              className="flex gap-2.5 text-sm font-medium text-slate-700"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
              {line}
            </motion.li>
          ))}
        </ul>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.5 }}
          className="mt-10"
        >
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
            See it in the app
          </p>
          <PhoneBrowsePreview />
        </motion.div>

        <div className="mt-10 flex flex-col gap-3">
          <Link
            to="/services"
            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-teal-600 px-6 text-sm font-bold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-700"
          >
            Find help nearby
          </Link>
          <Link
            to="/register"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-teal-700/20 bg-white px-6 text-sm font-semibold text-teal-900 shadow-sm transition hover:border-teal-600 hover:bg-teal-50"
          >
            Create free account
          </Link>
          <Link
            to="/for-new-providers"
            className="text-center text-sm font-medium text-slate-500 underline-offset-2 hover:text-teal-800 hover:underline"
          >
            I’m a service provider
          </Link>
        </div>
      </main>
    </div>
  );
}
