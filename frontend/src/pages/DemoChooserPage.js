import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SeoHead from '../components/SeoHead';
import { citySeo } from '../seo/citySeo';

/** Gate before Demo: customer → /for-customers, provider → /for-new-providers. */
export default function DemoChooserPage() {
  const canonical = `${citySeo.siteUrl}/demo/`;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-luminexa-canvas text-slate-900">
      <SeoHead
        title="Demo | Luminexa"
        description="Try Luminexa as a customer or a service provider. Pick your role to see the right walkthrough."
        canonical={canonical}
      />

      <header className="border-b border-teal-900/10 bg-white/95 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex min-h-[52px] max-w-lg items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-teal-950">
            Luminexa
          </Link>
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-teal-800 hover:text-teal-950"
          >
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-teal-700"
        >
          Demo
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-3 text-center text-[1.85rem] font-extrabold leading-tight tracking-tight text-teal-950 sm:text-4xl"
        >
          Are you a customer or a service provider?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-3 max-w-md text-center text-base leading-relaxed text-slate-600"
        >
          We’ll show you the right page — booking help nearby, or running jobs with Luminexa Pro.
        </motion.p>

        <div className="mt-8 grid gap-3">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
          >
            <Link
              to="/for-customers"
              className="flex min-h-[72px] flex-col items-center justify-center rounded-2xl border border-teal-700/15 bg-white px-5 py-5 text-center shadow-sm transition hover:border-teal-600 hover:bg-teal-50"
            >
              <span className="text-base font-bold text-teal-950">I’m a customer</span>
              <span className="mt-1 text-sm text-slate-600">See how booking works — free</span>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <Link
              to="/for-new-providers"
              className="flex min-h-[72px] flex-col items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-5 py-5 text-center shadow-sm transition hover:border-amber-400 hover:bg-amber-100"
            >
              <span className="text-base font-bold text-amber-950">I’m a service provider</span>
              <span className="mt-1 text-sm text-amber-900/80">See Pro &amp; try the live demo</span>
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
