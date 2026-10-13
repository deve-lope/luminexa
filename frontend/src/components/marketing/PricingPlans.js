import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import pricing from '../../seo/pricing.json';

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

/**
 * Customers Free + Luminexa Pro cards (+ optional fees note).
 * Shared by /pricing and the marketing homepage.
 */
export default function PricingPlans({
  findPath = null,
  showFees = true,
  showHeading = false,
  className = '',
}) {
  const customerPlan =
    findPath && findPath !== pricing.customer.ctaHref
      ? { ...pricing.customer, ctaHref: findPath }
      : pricing.customer;

  return (
    <div className={className}>
      {showHeading ? (
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {pricing.h1}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            {pricing.lead}
          </p>
        </motion.div>
      ) : null}

      <div
        className={`grid gap-6 lg:grid-cols-2 lg:gap-8 ${showHeading ? 'mt-10 md:mt-12' : ''}`}
      >
        <PlanColumn plan={customerPlan} />
        <PlanColumn plan={pricing.provider} featured />
      </div>

      {showFees ? (
        <motion.div
          {...fadeUp}
          className="mt-10 rounded-[1.5rem] bg-white p-6 ring-1 ring-slate-200 sm:p-8"
        >
          <h3 className="text-lg font-bold text-slate-900">{pricing.fees.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{pricing.fees.body}</p>
        </motion.div>
      ) : null}
    </div>
  );
}
