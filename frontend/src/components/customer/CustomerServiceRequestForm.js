import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { businessesAPI } from '../../utils/api';
import BookingServiceLocationSection from './BookingServiceLocationSection';
import CustomerServiceDetailsForm from './CustomerServiceDetailsForm';
import { validateServiceLocationValue } from './ServiceLocationInput';

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

function mergeCategoryNames(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const item of list || []) {
      const name = (typeof item === 'string' ? item : item?.name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: String(item?.slug || item?.id || name),
        name,
        icon: item?.icon || '',
      });
    }
  }
  return out;
}

export default function CustomerServiceRequestForm({
  orgSlug,
  businessTypes = [],
  categories = [],
  isGuest = false,
  loginNextUrl,
}) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState('');
  const [serviceLabel, setServiceLabel] = useState('');
  const [message, setMessage] = useState('');
  const [serviceAddress, setServiceAddress] = useState(
    () => (user?.default_service_address || '').trim()
  );
  const [preferredDate, setPreferredDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [platformTypes, setPlatformTypes] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const minDate = useMemo(() => todayInputValue(), []);

  useEffect(() => {
    const saved = (user?.default_service_address || '').trim();
    if (saved && !serviceAddress) {
      setServiceAddress(saved);
    }
  }, [user?.default_service_address, serviceAddress]);

  const categoryOptions = useMemo(
    () => mergeCategoryNames(categories, businessTypes, platformTypes),
    [categories, businessTypes, platformTypes],
  );

  // Always load the full platform catalog when the form opens so the dropdown is never empty.
  useEffect(() => {
    if (!expanded || isGuest) return undefined;
    let cancelled = false;
    setCategoriesLoading(true);
    businessesAPI
      .listBusinessTypes({ for_registration: true })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setPlatformTypes(list);
      })
      .catch(() => {
        if (!cancelled) setPlatformTypes([]);
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, isGuest]);

  const resetForm = useCallback(() => {
    setCategory('');
    setServiceLabel('');
    setMessage('');
    setServiceAddress((user?.default_service_address || '').trim());
    setPreferredDate('');
  }, [user?.default_service_address]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!category.trim()) {
      setError('Please select a category.');
      return;
    }
    const trimmed = message.trim();
    if (serviceAddress.trim()) {
      const locationCheck = validateServiceLocationValue(serviceAddress);
      if (!locationCheck.valid) {
        setError(locationCheck.error || 'Please enter a valid postal code.');
        return;
      }
    } else {
      setError('Please enter the job location.');
      return;
    }
    setSubmitting(true);
    try {
      const label = (serviceLabel.trim() || category).trim();
      await businessesAPI.submitServiceInquiry(orgSlug, {
        service_label: label,
        message: trimmed || `Custom request · ${category}`,
        service_address: serviceAddress.trim(),
        preferred_date: preferredDate || null,
      });
      setSuccess('Request sent! The business will follow up.');
      resetForm();
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
            Pick a category, describe the job, and when you&apos;d like it done. The business will
            follow up or add a booking for you.
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
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="custom-request-category" className="mb-1 block text-sm font-medium text-slate-700">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="custom-request-category"
            required
            value={category}
            disabled={categoriesLoading && categoryOptions.length === 0}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full min-h-[48px] appearance-none rounded-lg border border-slate-200 bg-white bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none focus:border-luminexa-accent focus:ring-1 focus:ring-luminexa-accent disabled:opacity-60"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%6494a3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
            }}
          >
            <option value="">
              {categoriesLoading ? 'Loading categories…' : 'Select a category'}
            </option>
            {categoryOptions.map((opt) => (
              <option key={opt.id} value={opt.name}>
                {opt.icon ? `${opt.icon} ` : ''}
                {opt.name}
              </option>
            ))}
          </select>
          {categoryOptions.length > 6 && (
            <p className="mt-1 text-xs text-slate-500">
              {categoryOptions.length} categories — scroll in the list to see all.
            </p>
          )}
        </div>
        <CustomerServiceDetailsForm
          serviceLabel={serviceLabel}
          onServiceLabelChange={setServiceLabel}
          serviceLabelTitle="More specific (optional)"
          serviceLabelPlaceholder="e.g. Deep clean kitchen, fix leaky faucet…"
          message={message}
          onMessageChange={setMessage}
          serviceAddress={serviceAddress}
          onServiceAddressChange={setServiceAddress}
          showLocation={false}
          compact
        />
        <BookingServiceLocationSection
          user={user}
          value={serviceAddress}
          onChange={setServiceAddress}
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
          className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send request'}
        </button>
      </form>
    </section>
  );
}
