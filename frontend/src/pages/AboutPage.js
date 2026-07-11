import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const FEATURES = [
  { icon: '🔍', title: 'Find the right person', text: 'Browse local providers by what you need.' },
  { icon: '📅', title: 'Book in seconds', text: 'Pick a time that works for you, online.' },
  { icon: '💬', title: 'Stay in touch', text: 'Message your provider and track your request.' },
];

function FeatureList({ className = '' }) {
  return (
    <ul className={`grid gap-3 text-left sm:grid-cols-3 ${className}`}>
      {FEATURES.map((item) => (
        <li
          key={item.title}
          className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-luminexa-accent/30 text-base">
            {item.icon}
          </span>
          <span>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-0.5 text-xs text-luminexa-mist/60">{item.text}</p>
          </span>
        </li>
      ))}
    </ul>
  );
}

function FeatureListEmbedded() {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {FEATURES.map((item) => (
        <li
          key={item.title}
          className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-base">
            {item.icon}
          </span>
          <span>
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-0.5 text-xs text-slate-600">{item.text}</p>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function AboutPage({ embedded = false }) {
  if (embedded) {
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-xl bg-gradient-to-br from-luminexa-navy via-slate-900 to-violet-950 p-6 text-luminexa-mist shadow-sm">
          <p className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-luminexa-accent">
            Local help, right where you are
          </p>
          <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight">
            Get help from people near you.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-luminexa-mist/75">
            Whatever you need done — cleaning, repairs, care, and more — Luminexa connects you
            with trusted local providers who are ready to help.
          </p>
        </section>
        <FeatureListEmbedded />
        <p className="text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Luminexa · Connecting people with local help
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-luminexa-navy text-luminexa-mist">
      <div className="pointer-events-none absolute -top-40 right-0 h-[28rem] w-[28rem] rounded-full bg-luminexa-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between px-4 py-5 md:px-8">
        <span className="text-xl font-bold tracking-tight">Luminexa</span>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            to="/login"
            className="flex min-h-[44px] items-center rounded-lg px-3 text-luminexa-mist/85"
          >
            Sign in
          </Link>
          <Link
            to="/register/business"
            className="flex min-h-[44px] items-center rounded-xl bg-luminexa-accent px-4 font-semibold text-white shadow-lg shadow-violet-900/30"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-8 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-2xl text-center"
        >
          <p className="mb-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-luminexa-accent">
            Local help, right where you are
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-[3.25rem]">
            Get help from people
            <br className="hidden sm:inline" /> near you.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg text-luminexa-mist/75">
            Whatever you need done — cleaning, repairs, care, and more — we connect you with
            trusted local providers who are ready to help.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/services"
              className="flex min-h-[52px] items-center justify-center rounded-2xl bg-luminexa-accent px-8 font-semibold text-white shadow-xl shadow-violet-900/35"
            >
              Find help near you
            </Link>
            <Link
              to="/register/business"
              className="flex min-h-[52px] items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-8 font-semibold backdrop-blur"
            >
              Offer your services
            </Link>
          </div>
          <FeatureList className="mt-10" />
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-white/10 px-4 py-5 text-center text-sm text-luminexa-mist/45 md:px-8">
        © {new Date().getFullYear()} Luminexa · Connecting people with local help
      </footer>
    </div>
  );
}
