import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SeoHead from '../components/SeoHead';
import { citySeo } from '../seo/citySeo';
import pricing from '../seo/pricing.json';
import { PLAY_STORE_URL } from '../utils/storeLinks';

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
};

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-5 w-5 shrink-0 text-teal-600"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PlanColumn({ plan, featured = false }) {
  const priceMain =
    plan.price === 'Free'
      ? 'Free'
      : `${plan.price} ${plan.currency || ''}`.trim();

  return (
    <motion.div
      {...fadeUp}
      className={`flex flex-col rounded-[1.75rem] p-6 sm:p-8 ${
        featured
          ? 'bg-teal-950 text-white shadow-xl shadow-teal-950/20'
          : 'bg-white text-slate-900 ring-1 ring-slate-200'
      }`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-[0.16em] ${
          featured ? 'text-teal-200' : 'text-teal-700'
        }`}
      >
        {plan.name}
      </p>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-4xl font-extrabold tracking-tight sm:text-5xl">{priceMain}</span>
        {plan.period ? (
          <span className={featured ? 'text-teal-100/80' : 'text-slate-500'}>/ {plan.period}</span>
        ) : null}
      </p>
      <p className={`mt-2 text-sm ${featured ? 'text-teal-50/85' : 'text-slate-600'}`}>
        {plan.priceNote}
      </p>
      <ul className="mt-8 flex-1 space-y-3">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-3 text-sm leading-snug">
            <CheckIcon />
            <span className={featured ? 'text-teal-50/95' : 'text-slate-700'}>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        to={plan.ctaHref}
        className={`mt-8 inline-flex min-h-[52px] items-center justify-center rounded-full px-6 text-sm font-bold transition ${
          featured
            ? 'bg-teal-400 text-teal-950 hover:bg-teal-300'
            : 'bg-teal-600 text-white hover:bg-teal-700'
        }`}
      >
        {plan.cta}
      </Link>
    </motion.div>
  );
}

/** Public pricing — customers free, providers Luminexa Pro. */
export default function PricingPage() {
  const canonical = `${citySeo.siteUrl}/pricing/`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: pricing.title,
      url: canonical,
      description: pricing.description,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Luminexa',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android',
      offers: [
        {
          '@type': 'Offer',
          name: 'Customers',
          price: '0',
          priceCurrency: 'CAD',
          description: 'Free for customers who book local services.',
        },
        {
          '@type': 'Offer',
          name: 'Luminexa Pro',
          price: '9.99',
          priceCurrency: 'CAD',
          description: 'Provider dashboard and business tools. Monthly after free trial.',
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: pricing.faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-luminexa-canvas text-slate-900">
      <SeoHead
        title={pricing.title}
        description={pricing.description}
        canonical={canonical}
        jsonLd={jsonLd}
      />
      <header className="border-b border-teal-900/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-slate-900">
            Luminexa
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link to="/services" className="hidden text-slate-600 hover:text-teal-700 sm:inline">
              Find help
            </Link>
            <Link
              to="/register/business"
              className="inline-flex min-h-[40px] items-center rounded-full bg-teal-600 px-4 text-white hover:bg-teal-700"
            >
              Offer services
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-teal-950 via-teal-900 to-teal-950 text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at 20% 0%, rgba(45,212,191,0.35), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(15,118,110,0.4), transparent 45%)',
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 md:px-8 md:pb-20 md:pt-20">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200"
            >
              Luminexa
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl"
            >
              {pricing.h1}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mt-4 max-w-xl text-base text-teal-50/85 sm:text-lg"
            >
              {pricing.lead}
            </motion.p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <PlanColumn plan={pricing.customer} />
            <PlanColumn plan={pricing.provider} featured />
          </div>

          <motion.div
            {...fadeUp}
            className="mt-10 rounded-[1.5rem] bg-white p-6 ring-1 ring-slate-200 sm:p-8"
          >
            <h2 className="text-lg font-bold text-slate-900">{pricing.fees.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{pricing.fees.body}</p>
          </motion.div>
        </section>

        <section className="border-t border-slate-200/80 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-14 md:px-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Questions</h2>
            <div className="mt-8 space-y-8">
              {pricing.faq.map((item) => (
                <motion.div key={item.q} {...fadeUp}>
                  <h3 className="text-base font-semibold text-slate-900">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="font-semibold text-slate-800">Luminexa</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/" className="hover:text-teal-700">
              Home
            </Link>
            <Link to="/services" className="hover:text-teal-700">
              Find help
            </Link>
            <Link to="/register/business" className="hover:text-teal-700">
              Offer services
            </Link>
            <Link to="/privacy" className="hover:text-teal-700">
              Privacy
            </Link>
            <a href={PLAY_STORE_URL} className="hover:text-teal-700">
              Google Play
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
