import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead';
import { citySeo } from '../seo/citySeo';
import { motion, useScroll, useTransform } from 'framer-motion';

const NEED_PROMPTS = [
  {
    q: 'Driveway buried in snow?',
    a: 'Find snow removal crews nearby — driveway, walkway, and seasonal clearing with open times.',
    hint: 'Snow removal',
  },
  {
    q: 'Car looking tired?',
    a: 'Book mobile or local car detailing — interior, exterior, and a visit at home or work.',
    hint: 'Car detailing',
  },
  {
    q: 'Wanna change your tires?',
    a: 'Find mobile tire techs and auto helpers nearby — see prices, then book a slot.',
    hint: 'Auto & tires',
  },
  {
    q: 'Need the house cleaned?',
    a: 'Browse cleaners with clear rates, chat about the job, and lock in a time.',
    hint: 'Home cleaning',
  },
];

const PLATFORM_POINTS = [
  {
    title: 'Find people who do the work',
    text: 'Browse local providers and gig-friendly businesses by what you actually need — not endless directories.',
  },
  {
    title: 'See prices before you book',
    text: 'Fixed rates, ranges, or quotes up front so you know what you are walking into.',
  },
  {
    title: 'Book real open times',
    text: 'Providers publish availability. You pick a slot that works — confirmed on both sides.',
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
    title: 'Compare locals',
    text: 'Check who’s nearby, what they charge, and when they’re free.',
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

function SiteHeader() {
  const [solid, setSolid] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 pt-safe transition duration-300 ${
        solid
          ? 'border-b border-teal-900/10 bg-white/90 shadow-sm backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        <Link
          to="/"
          className={`text-xl font-extrabold tracking-tight transition ${
            solid ? 'text-slate-900' : 'text-white'
          }`}
        >
          Luminexa
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href="#needs"
            className={`hidden min-h-[44px] items-center px-3 text-sm font-medium transition sm:inline-flex ${
              solid ? 'text-slate-600 hover:text-teal-700' : 'text-white/80 hover:text-white'
            }`}
          >
            What we help with
          </a>
          <a
            href="#how"
            className={`hidden min-h-[44px] items-center px-3 text-sm font-medium transition md:inline-flex ${
              solid ? 'text-slate-600 hover:text-teal-700' : 'text-white/80 hover:text-white'
            }`}
          >
            How it works
          </a>
          <Link
            to="/login"
            className={`inline-flex min-h-[44px] items-center px-3 text-sm font-medium transition ${
              solid ? 'text-slate-700 hover:text-teal-700' : 'text-white/90 hover:text-white'
            }`}
          >
            Sign in
          </Link>
          <Link
            to="/register/business"
            className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold shadow-lg transition ${
              solid
                ? 'bg-luminexa-accent text-white shadow-teal-600/20 hover:bg-luminexa-accent-dark'
                : 'bg-white text-teal-800 shadow-teal-950/20 hover:bg-teal-50'
            }`}
          >
            Offer services
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero({ embedded = false, findPath = '/services' }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '10%']);
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0.35]);

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden bg-teal-950 text-white ${
        embedded ? 'min-h-[70svh] rounded-3xl' : 'min-h-[100svh]'
      }`}
    >
      <motion.div style={{ y: imageY }} className="absolute inset-0 scale-110">
        <img
          src="https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=2400&q=80"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/35 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
      </motion.div>

      <motion.div
        style={{ y: contentY, opacity }}
        className={`relative z-10 mx-auto flex max-w-6xl flex-col justify-end px-4 pb-12 md:px-8 md:pb-16 ${
          embedded ? 'min-h-[70svh] pt-16' : 'min-h-[100svh] pt-28 pb-16 md:pb-24'
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
          When you need it done, book local help.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.22 }}
          className="mt-5 max-w-xl text-base leading-relaxed text-teal-50/85 sm:text-lg"
        >
          Find people nearby for tires, lawns, cleaning, repairs, and more — with clear prices and
          real booking times.
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
            Find help near you
          </Link>
          <a
            href="#needs"
            className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/30 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            What do you need done?
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}

function NeedPrompts({ findPath = '/services' }) {
  return (
    <section id="needs" className="bg-luminexa-canvas py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <motion.div {...fadeUp}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            Ask yourself
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-[2.75rem]">
            What do you need done this week?
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Start with the job. Luminexa helps you find local people who do gig-style and small
            business work — then book them with prices and schedules you can trust.
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
                className="group flex flex-col gap-2 py-7 transition sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:py-9"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600">
                    {item.hint}
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 transition group-hover:text-teal-700 sm:text-3xl md:text-[2rem]">
                    {item.q}
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                    {item.a}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-teal-700">
                  Browse providers
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
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
          <p className="mt-4 text-base leading-relaxed text-teal-100/75 sm:text-lg">
            Built for everyday service work — customers book faster, providers stay organized.
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
            Easy to find people. Proper bookings. Clear prices.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Whether it’s a one-off gig or a local business on your block, Luminexa keeps the
            messy parts of hiring help — chasing quotes, missing calls, unclear timing — out of
            the way.
          </p>
          <Link
            to={findPath}
            className="mt-8 inline-flex min-h-[48px] items-center rounded-full bg-luminexa-accent px-6 text-sm font-semibold text-white shadow-sm shadow-teal-600/25 transition hover:bg-luminexa-accent-dark"
          >
            Explore services nearby
          </Link>
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
            Hire help like you mean it.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Skip the group-chat scramble. See who’s available, what they charge, and book a time
            that actually works — then message them about the details.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700 sm:text-base">
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
              Open schedules from real local providers
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
            Publish services and prices, open your calendar, take requests, complete jobs, and
            issue invoices — built for lawn crews, cleaners, mobile techs, and local trades.
          </p>
          <Link
            to="/register/business"
            className="mt-8 inline-flex min-h-[48px] w-fit items-center rounded-full border border-teal-700/20 bg-white px-6 text-sm font-semibold text-teal-800 shadow-sm transition hover:border-teal-600 hover:bg-teal-50"
          >
            Start offering services
          </Link>
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

function FinalCta({ embedded = false, findPath = '/services' }) {
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
          Need something done? Find someone local.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-teal-50/80">
          Book help for the jobs that pile up — tires, lawns, cleaning, repairs — with schedules
          and prices that make sense.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={findPath}
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-teal-400 px-8 text-sm font-bold text-teal-950 transition hover:bg-teal-300 sm:w-auto"
          >
            Find help near you
          </Link>
          {!embedded && (
            <Link
              to="/register"
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-white/25 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10 sm:w-auto"
            >
              Create a customer account
            </Link>
          )}
        </div>
      </motion.div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-teal-900/10 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between md:px-8">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-slate-900">Luminexa</p>
          <p className="mt-1 text-sm text-slate-500">
            Local services, booked the simple way.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-600">
          <Link to="/services" className="hover:text-teal-700">
            Find help
          </Link>
          <Link to="/register/business" className="hover:text-teal-700">
            Offer services
          </Link>
          <Link to="/login" className="hover:text-teal-700">
            Sign in
          </Link>
          <Link to="/privacy" className="hover:text-teal-700">
            Privacy
          </Link>
        </div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Luminexa
      </div>
    </footer>
  );
}

/** Public marketing homepage (Calian-inspired structure, teal Luminexa brand). */
export default function LuminexaHomePage({ embedded = false }) {
  const findPath =
    embedded && typeof window !== 'undefined' && window.location.pathname.startsWith('/customer')
      ? '/customer/find'
      : '/services';

  return (
    <div className="bg-luminexa-canvas text-slate-900">
      {!embedded && (
        <SeoHead
          title="Luminexa | Book local services"
          description="Book local services — snow removal, car detailing, cleaning, repairs, and more — with prices and real time slots."
          canonical={`${citySeo.siteUrl}/`}
          jsonLd={{
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: citySeo.brand,
            url: citySeo.siteUrl,
            description: 'Book local services with prices and real time slots.',
            areaServed: citySeo.cities.map((c) => ({ '@type': 'City', name: c.city })),
            sameAs: citySeo.sameAs,
          }}
        />
      )}
      {!embedded && <SiteHeader />}
      <Hero embedded={embedded} findPath={findPath} />
      <NeedPrompts findPath={findPath} />
      <HowItWorks />
      <PlatformBand findPath={findPath} />
      <SplitShowcase />
      <FinalCta embedded={embedded} findPath={findPath} />
      {!embedded && <SiteFooter />}
      {embedded && (
        <p className="px-4 pb-8 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Luminexa
        </p>
      )}
    </div>
  );
}
