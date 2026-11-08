import React, { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
import HomeJourneyScrollZone from '../components/marketing/HomeJourneyScrollZone';
import InstagramLink from '../components/marketing/InstagramLink';
import PricingPlans from '../components/marketing/PricingPlans';
import SiteHeader from '../components/marketing/SiteHeader';
import { citySeo } from '../seo/citySeo';
import { PLAY_STORE_URL, getAppStoreUrl } from '../utils/storeLinks';
import { motion, useScroll, useTransform } from 'framer-motion';

const NEED_PROMPTS = [
  {
    q: 'Driveway buried in snow?',
    a: 'Book snow removal when a provider has open times — driveway, walkway, and seasonal clearing.',
    hint: 'Snow removal',
  },
  {
    q: 'Car looking tired?',
    a: 'Book car detailing with clear prices or a quote — interior, exterior, at home or work.',
    hint: 'Car detailing',
  },
  {
    q: 'Wanna change your tires?',
    a: 'Request auto help, see pricing options, then pick a slot that works.',
    hint: 'Auto & tires',
  },
  {
    q: 'Need the house cleaned?',
    a: 'See rates or request a quote, chat about the job, and lock in a time.',
    hint: 'Home cleaning',
  },
];

const PLATFORM_POINTS = [
  {
    title: 'Start from the job',
    text: 'Snow, detailing, cleaning, repairs — pick what you need and browse providers who list that service.',
  },
  {
    title: 'See prices before you book',
    text: 'Fixed rates, ranges, or quotes up front so you know what you are walking into.',
  },
  {
    title: 'Book real open times',
    text: 'Providers publish availability. You pick a slot — confirmed on both sides.',
  },
  {
    title: 'Stay in the loop',
    text: 'Message about the job, track status, and keep invoices when the work is finished.',
  },
];

const HOW_STEPS = [
  {
    n: '01',
    title: 'Say what you need',
    text: 'Snow, detailing, cleaning, repairs — start from the job, not a search maze.',
  },
  {
    n: '02',
    title: 'Compare options',
    text: 'Check services, prices or quotes, and open times from providers on Luminexa.',
  },
  {
    n: '03',
    title: 'Book and go',
    text: 'Confirm the visit, stay in touch, and get it done without phone tag.',
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 36 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
};

const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

function Hero({ inAppShell = false, findPath = '/services' }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '10%']);
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0.35]);

  const heroMinH = inAppShell
    ? 'min-h-[100svh] lg:min-h-[calc(100svh-var(--lx-header-offset))]'
    : 'min-h-[100svh]';

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden bg-teal-950 text-white ${heroMinH}`}
    >
      <motion.div style={{ y: imageY }} className="absolute inset-0 scale-110">
        <img
          src="/images/home-hero.jpg"
          alt=""
          className="h-full w-full object-cover"
        />
        {/* Original darker treatment — photo still visible, text readable, no card */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/35 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
      </motion.div>

      <motion.div
        style={{ y: contentY, opacity }}
        className={`relative z-10 mx-auto flex max-w-6xl flex-col justify-end px-4 md:px-8 ${heroMinH} ${
          inAppShell ? 'pt-28 pb-16 lg:pt-16 lg:pb-12' : 'pt-28 pb-16 md:pb-24'
        }`}
      >
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-200"
        >
          Luminexa
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.12 }}
          className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-[4rem]"
        >
          Book local services. Run your gigs simply.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.22 }}
          className="mt-5 max-w-xl text-base leading-relaxed text-teal-50/85 sm:text-lg"
        >
          Clear prices and open times for customers. Schedule, messages, and invoices for providers
          — Luminexa Pro $9.99 CAD/month after a free trial.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.32 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <Link
            to={findPath}
            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-teal-400 px-8 text-sm font-bold text-teal-950 shadow-xl shadow-teal-950/30 transition hover:bg-teal-300"
          >
            Find help
          </Link>
          {!inAppShell ? (
            <Link
              to="/demo"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-amber-400 px-8 text-sm font-bold text-amber-950 shadow-xl shadow-teal-950/20 transition hover:bg-amber-300"
            >
              Demo
            </Link>
          ) : (
            <a
              href="#needs"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/30 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              What do you need done?
            </a>
          )}
        </motion.div>
        {!inAppShell && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42 }}
            className="mt-4 text-sm text-teal-100/80"
          >
            Service provider?{' '}
            <Link to="/for-new-providers" className="font-semibold text-white underline-offset-2 hover:underline">
              See Pro &amp; pricing
            </Link>
          </motion.p>
        )}
      </motion.div>
    </section>
  );
}

function NeedPrompts({ findPath = '/services', inZone = false }) {
  return (
    <section
      id="needs"
      className={inZone ? 'bg-transparent py-12 md:py-20' : 'bg-luminexa-canvas py-20 md:py-28'}
    >
      <div className={inZone ? 'w-full' : 'mx-auto max-w-6xl px-4 md:px-8'}>
        <motion.div {...fadeUp}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 md:text-sm">
            Ask yourself
          </p>
          <h2
            className={`mt-3 font-extrabold tracking-tight text-slate-900 ${
              inZone
                ? 'max-w-4xl text-3xl sm:text-4xl md:text-[2.85rem] md:leading-tight'
                : 'max-w-2xl text-3xl sm:text-4xl md:text-[2.75rem]'
            }`}
          >
            What do you need done this week?
          </h2>
          <p
            className={`mt-4 leading-relaxed text-slate-600 ${
              inZone ? 'max-w-3xl text-base sm:text-lg md:text-xl' : 'max-w-xl text-base sm:text-lg'
            }`}
          >
            Start with the job. Browse providers who list that service, see prices or request a
            quote, then book an open time.
          </p>
        </motion.div>

        <motion.ul
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-12 divide-y divide-teal-900/10 border-y border-teal-900/10"
        >
          {NEED_PROMPTS.map((item) => (
            <motion.li key={item.q} variants={staggerChild}>
              <Link
                to={findPath}
                className="group block py-7 transition sm:py-9"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600">
                    {item.hint}
                  </p>
                  <p
                    className={`mt-2 font-bold tracking-tight text-slate-900 transition group-hover:text-teal-700 ${
                      inZone
                        ? 'text-2xl sm:text-3xl md:text-[2.1rem] md:leading-snug'
                        : 'text-2xl sm:text-3xl md:text-[2rem]'
                    }`}
                  >
                    {item.q}
                  </p>
                  <p
                    className={`mt-2 leading-relaxed text-slate-600 ${
                      inZone ? 'max-w-3xl text-base md:text-lg' : 'max-w-xl text-sm sm:text-base'
                    }`}
                  >
                    {item.a}
                  </p>
                </div>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-teal-950 py-20 text-white md:py-28">
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 md:px-8">
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            From “I need help” to a booked visit.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-teal-100/80 sm:text-lg">
            Built for everyday service work — customers book without phone tag; providers run
            schedule and invoices in one place.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {HOW_STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.08 }}
            >
              <p className="text-sm font-bold tabular-nums text-teal-400">{step.n}</p>
              <h3 className="mt-3 text-xl font-bold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                {step.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlatformBand({ findPath = '/services' }) {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 md:grid-cols-12 md:gap-10 md:px-8">
        <motion.div {...fadeUp} className="md:col-span-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            Why Luminexa
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Clear prices. Real open times. Simple tools.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Luminexa is a booking and business app for local services. Customers book with less
            phone tag. Providers publish services, open a calendar, message clients, and invoice —
            without expensive field-service software.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to={findPath}
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-luminexa-accent px-6 text-sm font-semibold text-white shadow-sm shadow-teal-600/25 transition hover:bg-luminexa-accent-dark"
            >
              Browse services
            </Link>
            <Link
              to="/for-new-providers"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-teal-700/20 bg-white px-6 text-sm font-semibold text-teal-800 shadow-sm transition hover:border-teal-600 hover:bg-teal-50"
            >
              For new providers
            </Link>
          </div>
        </motion.div>

        <motion.ul
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="space-y-0 md:col-span-7"
        >
          {PLATFORM_POINTS.map((item, index) => (
            <motion.li
              key={item.title}
              variants={staggerChild}
              className="border-t border-slate-200 py-6 first:border-t-0 first:pt-0"
            >
              <div className="flex gap-4">
                <span className="mt-1 text-sm font-bold tabular-nums text-teal-600">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:text-base">
                    {item.text}
                  </p>
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

function SplitShowcase() {
  return (
    <section className="overflow-hidden bg-luminexa-canvas">
      <div className="mx-auto grid max-w-6xl md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative min-h-[320px] md:min-h-[480px]"
        >
          <img
            src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80"
            alt="Local service professional at work"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/10" />
        </motion.div>

        <motion.div
          {...fadeUp}
          className="flex flex-col justify-center px-4 py-14 md:px-12 md:py-20"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            For customers
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Hire help without the phone tag.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            See what a provider charges (or request a quote), pick an open time, and message about
            the details — free for customers.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700 sm:text-base">
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
              Browse services and open schedules
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
              Prices and quotes shown before you commit
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
              Job chat and status in one place
            </li>
          </ul>
        </motion.div>
      </div>

      <div className="mx-auto grid max-w-6xl md:grid-cols-2">
        <motion.div
          {...fadeUp}
          className="order-2 flex flex-col justify-center px-4 py-14 md:order-1 md:px-12 md:py-20"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            For providers
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Run your gigs like a business.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Publish services and prices, open your calendar, take requests, message clients, and
            issue invoices — for snow crews, cleaners, detailers, and local trades. Luminexa Pro is
            $9.99 CAD/month after a free trial.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/demo"
              className="inline-flex min-h-[48px] w-fit items-center rounded-full bg-amber-500 px-6 text-sm font-bold text-amber-950 shadow-sm transition hover:bg-amber-400"
            >
              Demo
            </Link>
            <Link
              to="/register/business"
              className="inline-flex min-h-[48px] w-fit items-center rounded-full bg-luminexa-accent px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-luminexa-accent-dark"
            >
              Start free trial
            </Link>
            <Link
              to="/for-new-providers"
              className="inline-flex min-h-[48px] w-fit items-center rounded-full border border-teal-700/20 bg-white px-6 text-sm font-semibold text-teal-800 shadow-sm transition hover:border-teal-600 hover:bg-teal-50"
            >
              Why it’s good value
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative order-1 min-h-[320px] md:order-2 md:min-h-[480px]"
        >
          <img
            src="https://images.unsplash.com/photo-1599082267768-4815b2ea6bd2?auto=format&fit=crop&w=1600&q=80"
            alt="Mechanic changing a car tire"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent md:bg-gradient-to-l md:from-transparent md:to-black/10" />
        </motion.div>
      </div>
    </section>
  );
}

function FinalCta({ inAppShell = false, findPath = '/services' }) {
  return (
    <section className="relative overflow-hidden bg-teal-900 py-20 text-white md:py-24">
      <motion.div
        aria-hidden
        animate={{ x: [0, 24, 0], y: [0, -12, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -left-10 top-0 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl"
      />
      <motion.div
        aria-hidden
        animate={{ x: [0, -18, 0], y: [0, 16, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -right-8 bottom-0 h-72 w-72 rounded-full bg-cyan-300/15 blur-3xl"
      />

      <motion.div {...fadeUp} className="relative mx-auto max-w-3xl px-4 text-center md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
          Ready when you are
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          Book help — or run your service business.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-teal-50/85">
          Customers book free. Providers use Luminexa Pro for schedule, messages, and invoices at
          $9.99 CAD/month after a free trial.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={findPath}
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-teal-400 px-8 text-sm font-bold text-teal-950 transition hover:bg-teal-300 sm:w-auto"
          >
            Find help
          </Link>
          {!inAppShell && (
            <Link
              to="/demo"
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-amber-400 px-8 text-sm font-bold text-amber-950 transition hover:bg-amber-300 sm:w-auto"
            >
              Demo
            </Link>
          )}
        </div>
      </motion.div>
    </section>
  );
}

function HomePricing({ findPath = '/services' }) {
  return (
    <section id="pricing" className="scroll-mt-24 border-t border-teal-900/10 bg-luminexa-canvas py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <PricingPlans findPath={findPath} showHeading showFees={false} />
      </div>
    </section>
  );
}

function SiteFooter({ findPath = '/services', inApp = false }) {
  return (
    <footer className="border-t border-teal-900/10 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between md:px-8">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-slate-900">Luminexa</p>
          <p className="mt-1 text-sm text-slate-500">
            Booking and business tools for local services.
          </p>
          <div className="mt-4">
            <InstagramLink />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-600">
          <Link to={findPath} className="hover:text-teal-700">
            Find help
          </Link>
          {!inApp && (
            <>
              <Link to="/for-customers" className="hover:text-teal-700">
                For customers
              </Link>
              <Link to="/for-new-providers" className="hover:text-teal-700">
                For providers
              </Link>
              <Link to="/pricing" className="hover:text-teal-700">
                Pricing
              </Link>
              <Link to="/alternatives" className="hover:text-teal-700">
                Alternatives
              </Link>
              <Link to="/demo" className="hover:text-teal-700">
                Demo
              </Link>
              <Link to="/register/business" className="hover:text-teal-700">
                Offer services
              </Link>
              <Link to="/login" className="hover:text-teal-700">
                Sign in
              </Link>
            </>
          )}
          <Link to="/privacy" className="hover:text-teal-700">
            Privacy
          </Link>
          <a href={PLAY_STORE_URL} className="hover:text-teal-700" target="_blank" rel="noopener noreferrer">
            Google Play
          </a>
          <a href={getAppStoreUrl()} className="hover:text-teal-700" target="_blank" rel="noopener noreferrer">
            App Store
          </a>
        </div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Luminexa
      </div>
    </footer>
  );
}

/** Resolve browse/find links for public vs in-app About view. */
export function resolveHomeFindPath({ inAppShell, pathname = '' }) {
  return inAppShell && pathname.startsWith('/customer') ? '/customer/find' : '/services';
}

/** In-app About → customer or provider home (phone marketing header). */
export function resolveAboutAppBack(pathname = '') {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/customer/about') return '/customer';
  const match = path.match(/^(\/provider\/[^/]+)\/about$/);
  return match ? match[1] : null;
}

/** Public marketing homepage (Calian-inspired structure, teal Luminexa brand). */
export default function LuminexaHomePage({ inAppShell = false }) {
  const location = useLocation();
  const findPath = resolveHomeFindPath({
    inAppShell,
    pathname: location.pathname,
  });
  const appBackTo = inAppShell ? resolveAboutAppBack(location.pathname) : null;

  return (
    <div className="bg-luminexa-canvas text-slate-900">
      {!inAppShell && (
        <SeoHead
          title="Luminexa | Book local services & run your gigs"
          description="Book local services with prices and open times. Providers get schedule, messages, and invoices on Luminexa Pro for $9.99 CAD/month after a free trial."
          canonical={`${citySeo.siteUrl}/`}
          jsonLd={{
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: citySeo.brand,
            url: citySeo.siteUrl,
            description:
              'Booking and business app for local services. Customers book free; providers use Luminexa Pro for $9.99 CAD/month after a free trial.',
            areaServed: citySeo.cities.map((c) => ({ '@type': 'City', name: c.city })),
            sameAs: citySeo.sameAs,
          }}
        />
      )}
      {!inAppShell && <SiteHeader />}
      {inAppShell && appBackTo && (
        <div className="lg:hidden">
          <SiteHeader appBackTo={appBackTo} />
        </div>
      )}
      <Hero inAppShell={inAppShell} findPath={findPath} />
      <HomeJourneyScrollZone>
        <NeedPrompts findPath={findPath} inZone />
      </HomeJourneyScrollZone>
      <HowItWorks />
      <PlatformBand findPath={findPath} />
      <SplitShowcase />
      <FinalCta inAppShell={inAppShell} findPath={findPath} />
      <HomePricing findPath={findPath} />
      {!inAppShell && <SiteFooter />}
      {inAppShell && (
        <div className="lg:hidden">
          <SiteFooter findPath={findPath} inApp />
        </div>
      )}
    </div>
  );
}
