import React from 'react';
import { Link } from 'react-router-dom';

const UPDATED = 'July 14, 2026';
const CONTACT = 'support@luminex-a.com';
const APP_URL = 'https://app.luminex-a.com';

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

/** Public privacy policy — required for Play Store / PWA install transparency. */
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-[100dvh] bg-luminexa-canvas text-slate-900">
      <header className="border-b border-teal-900/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 md:px-8">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-slate-900">
            Luminexa
          </Link>
          <Link to="/services" className="text-sm font-medium text-teal-700 hover:text-teal-800">
            Find help
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Legal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">
          Last updated {UPDATED}. Applies to {APP_URL} and the Luminexa progressive web app.
        </p>

        <Section title="Who we are">
          <p>
            Luminexa (“we”, “us”) is a local service booking platform. Customers find and book
            providers; businesses manage schedules, bookings, and related job workflows.
          </p>
          <p>
            Contact:{' '}
            <a className="font-medium text-teal-700 hover:underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
          </p>
        </Section>

        <Section title="Information we collect">
          <p>
            <strong>Account information.</strong> Name, email address, phone number (when provided),
            password or one-time login codes, and profile details you enter.
          </p>
          <p>
            <strong>Business profile information.</strong> Business name, service descriptions,
            photos you upload, service area (address / postal code, map coordinates, service radius),
            booking policy, and related settings.
          </p>
          <p>
            <strong>Location information.</strong> When you search for services, we may use a postal
            / ZIP code and/or approximate coordinates (from address search, map selection, or device
            location if you allow it) plus a search radius in miles. Providers set service locations
            and radii so customers nearby can find them.
          </p>
          <p>
            <strong>Bookings and messages.</strong> Service requests, booking times, addresses for
            service visits, notes, status history, invoices/billing details you enter in the product,
            and in-app messages related to a job.
          </p>
          <p>
            <strong>Device and technical data.</strong> Basic logs such as IP address, browser type,
            and pages requested, used for security, debugging, and reliable delivery of the service.
            If you install the app as a PWA, the browser may store an install preference and cached
            app shell files on your device.
          </p>
        </Section>

        <Section title="How we use information">
          <ul className="list-disc space-y-2 pl-5">
            <li>Create and manage accounts (customers, business owners, staff)</li>
            <li>Match customers with nearby providers (dual radius / location search)</li>
            <li>Schedule, confirm, reschedule, and complete bookings</li>
            <li>Send transactional notices (e.g. booking status, login or verification codes)</li>
            <li>Operate, secure, and improve Luminexa</li>
            <li>Comply with law and enforce our terms of use where applicable</li>
          </ul>
        </Section>

        <Section title="Sharing">
          <p>
            We share information as needed to provide the service: for example, a provider sees
            customer booking details for jobs with their business; a customer sees the business
            profile and booking status. We use infrastructure providers (hosting, email delivery)
            who process data on our instructions. We do not sell your personal information.
          </p>
        </Section>

        <Section title="Retention">
          <p>
            We keep account and booking records while your account is active and as needed for
            legitimate business, security, and legal purposes. You can delete your account at any
            time (see “Deleting your account” below); some records may be retained in anonymized form
            where required by law or for dispute resolution.
          </p>
        </Section>

        <Section title="Deleting your account">
          <p>
            You can permanently delete your account and personal data in two ways:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              In the app: <strong>Account → Delete account</strong>
            </li>
            <li>
              On the web:{' '}
              <Link to="/delete-account" className="font-medium text-teal-700 hover:underline">
                {APP_URL}/delete-account
              </Link>
            </li>
          </ul>
          <p>
            Deletion removes your profile details (name, email, phone, address) and closes your
            account. Booking and invoice records may be kept in anonymized form where required by
            law or for dispute resolution.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-2 pl-5">
            <li>Update profile and business settings in the app</li>
            <li>Deny or revoke device location permission in your browser/OS settings</li>
            <li>
              Delete your account in-app or at{' '}
              <Link to="/delete-account" className="font-medium text-teal-700 hover:underline">
                /delete-account
              </Link>
            </li>
            <li>Request access by emailing {CONTACT}</li>
            <li>Uninstall the PWA / clear site data from your browser</li>
          </ul>
        </Section>

        <Section title="Security">
          <p>
            We use HTTPS in production and industry-standard practices to protect accounts and data
            in transit. No method of transmission or storage is 100% secure.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Luminexa is not directed at children under 13, and we do not knowingly collect personal
            information from children under 13.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update this policy from time to time. The “Last updated” date at the top will
            change when we do. Continued use of Luminexa after an update means you accept the revised
            policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Privacy questions or deletion requests:{' '}
            <a className="font-medium text-teal-700 hover:underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
          </p>
        </Section>

        <p className="mt-10 text-sm text-slate-500">
          <Link to="/" className="font-medium text-teal-700 hover:underline">
            ← Back to Luminexa
          </Link>
        </p>
      </main>
    </div>
  );
}
