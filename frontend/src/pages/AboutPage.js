import React from 'react';
import LuminexaHomePage from './LuminexaHomePage';

const WHY_US = [
  {
    title: 'Book local help fast',
    text: 'Find nearby providers, pick a time, and confirm — without phone tag.',
  },
  {
    title: 'Clear schedules for both sides',
    text: 'Customers see open times. Providers run jobs, requests, and invoices in one place.',
  },
  {
    title: 'Stay connected end to end',
    text: 'Message about the job, track status, and keep invoices handy when work is done.',
  },
  {
    title: 'Built for real service work',
    text: 'From cleaning and repairs to care and specialty trades — simple tools that fit how local businesses operate.',
  },
];

function EmbeddedAbout() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-4">
      <section className="lx-hero-soft px-5 py-6 sm:px-6 sm:py-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
          Luminexa
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
          Local services, booked the simple way.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[0.95rem]">
          Luminexa connects customers with trusted local providers — and gives businesses a clear
          way to schedule work, stay in touch, and get paid.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Why people choose Luminexa
        </h2>
        <ol className="mt-4 space-y-0">
          {WHY_US.map((item, index) => (
            <li
              key={item.title}
              className="flex gap-4 border-t border-luminexa-line py-4 first:border-t-0 first:pt-0"
            >
              <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold tabular-nums text-luminexa-accent">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Luminexa
      </p>
    </div>
  );
}

export default function AboutPage({ embedded = false }) {
  if (embedded) return <EmbeddedAbout />;
  return <LuminexaHomePage />;
}
