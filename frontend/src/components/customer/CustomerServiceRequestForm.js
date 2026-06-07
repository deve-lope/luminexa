import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerServiceDetailsForm from './CustomerServiceDetailsForm';
import { businessesAPI } from '../../utils/api';

function parseError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  if (d?.message?.[0]) return d.message[0];
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Could not send your request.';
}

function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CustomerServiceRequestForm({
  orgSlug,
  businessTypes = [],
  isGuest = false,
  loginNextUrl,
}) {
  const [expanded, setExpanded] = useState(false);
  const [serviceLabel, setServiceLabel] = useState('');
  const [message, setMessage] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const minDate = useMemo(() => todayInputValue(), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setError('Please describe what you need in at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await businessesAPI.submitServiceInquiry(orgSlug, {
        service_label: serviceLabel.trim(),
        message: trimmed,
        service_address: serviceAddress.trim(),
        preferred_date: preferredDate || null,
      });
      setSuccess('Request sent! The business will follow up.');
      setMessage('');
      setServiceLabel('');
      setServiceAddress('');
      setPreferredDate('');
      setExpanded(false);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-700">
          Can&apos;t find what you need?{' '}
          <span className="text-slate-600">Request a custom service and we&apos;ll follow up.</span>
        </p>
        {isGuest ? (
          <Link
            to={`/login?next=${encodeURIComponent(loginNextUrl || '/')}`}
            className="mt-2 inline-flex min-h-[40px] items-center text-sm font-medium text-luminexa-accent"
          >
            Sign in to send a request →
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-2 inline-flex min-h-[40px] items-center text-sm font-medium text-luminexa-accent"
          >
            Send a custom request →
          </button>
        )}
      </section>
    );
  }

  if (isGuest) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-700">
          Sign in to describe your custom job and preferred date.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            to={`/login?next=${encodeURIComponent(loginNextUrl || '/')}`}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-luminexa-accent px-4 text-sm font-medium text-white"
          >
            Sign in
          </Link>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 px-4 text-sm text-slate-600"
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Custom service request</h2>
          <p className="mt-1 text-sm text-slate-600">
            Describe the job and when you&apos;d like it done. The business will follow up or add a
            booking for you.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setError(null);
          }}
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
        >
          Close
        </button>
      </div>
      {businessTypes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {businessTypes.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setServiceLabel(t.name)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:border-luminexa-accent"
            >
              {t.icon && <span className="mr-1">{t.icon}</span>}
              {t.name}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <CustomerServiceDetailsForm
          serviceLabel={serviceLabel}
          onServiceLabelChange={setServiceLabel}
          message={message}
          onMessageChange={setMessage}
          serviceAddress={serviceAddress}
          onServiceAddressChange={setServiceAddress}
          compact
        />
        <div>
          <label htmlFor="preferred-date" className="mb-1 block text-sm font-medium text-slate-700">
            Preferred date <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="preferred-date"
            type="date"
            min={minDate}
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[48px] rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send request'}
        </button>
      </form>
    </section>
  );
}
