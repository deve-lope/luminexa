import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { publicServicesCatalog, serviceDetail } from '../../utils/customerPaths';
import ServiceGalleryEditor from '../../components/services/ServiceGalleryEditor';
import ServiceRatingSummary from '../../components/services/ServiceRatingSummary';
import {
  formatDurationLabel,
  formatServiceMeta,
  hoursFromMinutes,
  minutesFromHours,
} from '../../utils/serviceDisplay';
import {
  hasFinishedProviderSetupWizard,
  isProviderWizardStepDone,
  markProviderWizardStepDone,
  providerSetupPath,
} from '../../utils/profileSetup';

const INPUT_CLASS =
  'w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-luminexa-accent focus:outline-none focus:ring-2 focus:ring-luminexa-accent/20';
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-slate-600';

function FieldToggle({ checked, onChange, label, description, info }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-luminexa-accent/40"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-800">{label}</span>
            {description && (
              <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
            )}
          </span>
          <span
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
              checked ? 'bg-luminexa-accent' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                checked ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
        {info && (
          <button
            type="button"
            aria-label="More about this setting"
            aria-expanded={showInfo}
            onClick={() => setShowInfo((v) => !v)}
            className={`flex h-auto w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold transition ${
              showInfo
                ? 'border-luminexa-accent bg-violet-50 text-luminexa-accent'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            i
          </button>
        )}
      </div>
      {info && showInfo && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          {info}
        </p>
      )}
    </div>
  );
}

const emptyServiceDraft = () => ({
  name: '',
  description: '',
  category: '',
  duration_hours: '1',
  pricing_type: 'fixed',
  base_price: '0',
  price_max: '',
  quote_questions: [''],
  show_price: true,
  allow_request: true,
  fulfillment_kind: 'mobile',
});

const emptyBulkRow = () => ({
  name: '',
  base_price: '',
  price_max: '',
  description: '',
});

const emptyBulkDefaults = (category = '') => ({
  category: category || '',
  duration_hours: '1',
  pricing_type: 'fixed',
  show_price: true,
  allow_request: true,
  fulfillment_kind: 'mobile',
});

function FilterChip({ label, count, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition ${
        selected
          ? 'border-teal-700 bg-teal-700 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/50'
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded-lg px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
          selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function serviceNeedsDetails(service) {
  const hasDescription = Boolean(service.description?.trim());
  const hasPricing =
    service.pricing_type === 'quote' ||
    service.pricing_type === 'average' ||
    service.pricing_type === 'range' ||
    (service.base_price != null && Number(service.base_price) > 0);
  return !hasDescription || !hasPricing;
}

function ServiceDetailForm({
  serviceDraft,
  setServiceDraft,
  activeCategories,
  editingServiceId,
  savingService,
  onSubmit,
  onCancel,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-lx-soft ring-1 ring-teal-600/10"
    >
      <div className="flex items-center justify-between gap-3 border-b border-teal-100 bg-teal-50/50 px-4 py-3 sm:px-5">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            {editingServiceId ? 'Edit service details' : 'New service'}
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            {editingServiceId
              ? 'Update what customers see and how this service is booked.'
              : 'Fill in the details customers will see on your catalog.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <label htmlFor="svc-name" className={LABEL_CLASS}>
            Service name
          </label>
          <input
            id="svc-name"
            required
            value={serviceDraft.name}
            onChange={(e) => setServiceDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Standard oil change"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="svc-description" className={LABEL_CLASS}>
            Description — what&apos;s included?
          </label>
          <textarea
            id="svc-description"
            value={serviceDraft.description}
            onChange={(e) => setServiceDraft((d) => ({ ...d, description: e.target.value }))}
            rows={4}
            placeholder="Describe the work, what customers should expect, and any notes…"
            className={`${INPUT_CLASS} min-h-[96px] py-2 leading-relaxed`}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="svc-category" className={LABEL_CLASS}>
              Category
            </label>
            <select
              id="svc-category"
              value={serviceDraft.category}
              onChange={(e) => setServiceDraft((d) => ({ ...d, category: e.target.value }))}
              className={INPUT_CLASS}
            >
              <option value="">— No category —</option>
              {activeCategories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </option>
              ))}
            </select>
            {activeCategories.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Categories are managed by Luminexa. Refresh this page if the list is empty.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="svc-pricing" className={LABEL_CLASS}>
              Pricing
            </label>
            <select
              id="svc-pricing"
              value={
                serviceDraft.pricing_type === 'quote' ? 'average' : serviceDraft.pricing_type
              }
              onChange={(e) =>
                setServiceDraft((d) => ({
                  ...d,
                  pricing_type: e.target.value,
                  show_price: e.target.value === 'fixed' ? d.show_price : true,
                }))
              }
              className={INPUT_CLASS}
            >
              <option value="fixed">Fixed price</option>
              <option value="range">Price range (quote before confirm)</option>
              <option value="average">Typical price (quote before confirm)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Fixed uses your booking rules. Range and typical always send a quote for the customer
              to accept — customers still see the estimate you enter.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="svc-price" className={LABEL_CLASS}>
              {serviceDraft.pricing_type === 'range'
                ? 'From ($)'
                : serviceDraft.pricing_type === 'average' || serviceDraft.pricing_type === 'quote'
                  ? 'Typical price ($)'
                  : 'Rate ($)'}
            </label>
            <input
              id="svc-price"
              type="number"
              min={0}
              step="0.01"
              value={serviceDraft.base_price}
              onChange={(e) => setServiceDraft((d) => ({ ...d, base_price: e.target.value }))}
              className={INPUT_CLASS}
              required={
                serviceDraft.pricing_type === 'average' ||
                serviceDraft.pricing_type === 'range' ||
                serviceDraft.pricing_type === 'quote'
              }
            />
          </div>
          {(serviceDraft.pricing_type === 'range') && (
            <div>
              <label htmlFor="svc-price-max" className={LABEL_CLASS}>
                To ($)
              </label>
              <input
                id="svc-price-max"
                type="number"
                min={0}
                step="0.01"
                value={serviceDraft.price_max}
                onChange={(e) => setServiceDraft((d) => ({ ...d, price_max: e.target.value }))}
                className={INPUT_CLASS}
                required
              />
            </div>
          )}
          <div>
            <label htmlFor="svc-duration" className={LABEL_CLASS}>
              Duration (hours)
            </label>
            <input
              id="svc-duration"
              type="number"
              min={0.25}
              step={0.25}
              value={serviceDraft.duration_hours}
              onChange={(e) => setServiceDraft((d) => ({ ...d, duration_hours: e.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {(serviceDraft.pricing_type === 'range' ||
          serviceDraft.pricing_type === 'average' ||
          serviceDraft.pricing_type === 'quote') && (
          <div className="space-y-2">
            <p className={LABEL_CLASS}>Quote questions (asked when customer requests)</p>
            <p className="text-xs text-slate-500">
              Prefill questions so customers answer up front — less back-and-forth before you send
              the final price.
            </p>
            {(serviceDraft.quote_questions || ['']).map((q, idx) => (
              <div key={`qq-${idx}`} className="flex gap-2">
                <input
                  type="text"
                  value={q}
                  placeholder={`Question ${idx + 1}`}
                  onChange={(e) => {
                    const next = [...(serviceDraft.quote_questions || [''])];
                    next[idx] = e.target.value;
                    setServiceDraft((d) => ({ ...d, quote_questions: next }));
                  }}
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-slate-200 px-2 text-sm text-slate-600"
                  onClick={() => {
                    const next = (serviceDraft.quote_questions || ['']).filter((_, i) => i !== idx);
                    setServiceDraft((d) => ({
                      ...d,
                      quote_questions: next.length ? next : [''],
                    }));
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-medium text-luminexa-accent"
              onClick={() =>
                setServiceDraft((d) => ({
                  ...d,
                  quote_questions: [...(d.quote_questions || []), ''],
                }))
              }
            >
              + Add question
            </button>
          </div>
        )}

        <div className="space-y-2">
          <p className={LABEL_CLASS}>Where is this job done?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${
                serviceDraft.fulfillment_kind === 'mobile'
                  ? 'border-luminexa-accent bg-violet-50/80 ring-1 ring-luminexa-accent/20'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <input
                type="radio"
                name="fulfillment_kind"
                checked={serviceDraft.fulfillment_kind === 'mobile'}
                onChange={() => setServiceDraft((d) => ({ ...d, fulfillment_kind: 'mobile' }))}
                className="mt-0.5 accent-luminexa-accent"
              />
              <span>
                <span className="font-semibold text-slate-900">Mobile</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  You go to the customer
                </span>
              </span>
            </label>
            <label
              className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${
                serviceDraft.fulfillment_kind === 'shop'
                  ? 'border-luminexa-accent bg-violet-50/80 ring-1 ring-luminexa-accent/20'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <input
                type="radio"
                name="fulfillment_kind"
                checked={serviceDraft.fulfillment_kind === 'shop'}
                onChange={() => setServiceDraft((d) => ({ ...d, fulfillment_kind: 'shop' }))}
                className="mt-0.5 accent-luminexa-accent"
              />
              <span>
                <span className="font-semibold text-slate-900">In-shop</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Customer comes to your shop
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          {serviceDraft.pricing_type === 'fixed' && (
            <FieldToggle
              checked={serviceDraft.show_price}
              onChange={(val) => setServiceDraft((d) => ({ ...d, show_price: val }))}
              label="Show price on public page"
              description="Display this service's price to customers browsing your catalog."
            />
          )}
          {(serviceDraft.pricing_type === 'range' ||
            serviceDraft.pricing_type === 'average' ||
            serviceDraft.pricing_type === 'quote') && (
            <p className="text-xs text-slate-500">
              Customers always see your range or typical price for quote services.
            </p>
          )}
          <FieldToggle
            checked={serviceDraft.allow_request}
            onChange={(val) => setServiceDraft((d) => ({ ...d, allow_request: val }))}
            label="Allow “Request service” from customers"
            description="Customers can ask for this job without picking a time first."
            info="Use this when you want to talk first, then set the appointment yourself. The customer sends a request; you consult them and choose a time. Calendar booking can still be available for people who prefer to book a slot."
          />
        </div>

        {editingServiceId && (
          <div className="border-t border-slate-100 pt-4">
            <ServiceGalleryEditor serviceId={editingServiceId} />
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
        <button
          type="submit"
          disabled={savingService}
          className="min-h-[44px] flex-1 rounded-lg bg-luminexa-accent font-medium text-white transition hover:bg-luminexa-accent/90 disabled:opacity-60"
        >
          {savingService ? 'Saving…' : editingServiceId ? 'Save details' : 'Add service'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Create several catalog services in one go (shared category/pricing defaults + per-row name/price).
 */
function BulkAddServicesForm({
  bulkDefaults,
  setBulkDefaults,
  bulkRows,
  setBulkRows,
  activeCategories,
  savingService,
  onSubmit,
  onCancel,
}) {
  const namedCount = bulkRows.filter((r) => r.name.trim()).length;
  const updateRow = (index, patch) => {
    setBulkRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <form
      onSubmit={onSubmit}
      className="overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-lx-soft ring-1 ring-teal-600/10"
    >
      <div className="flex items-center justify-between gap-3 border-b border-teal-100 bg-teal-50/50 px-4 py-3 sm:px-5">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Add services</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Create several offerings at once. You can refine descriptions and photos later.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="bulk-category" className={LABEL_CLASS}>
              Category (all rows)
            </label>
            <select
              id="bulk-category"
              value={bulkDefaults.category}
              onChange={(e) => setBulkDefaults((d) => ({ ...d, category: e.target.value }))}
              className={INPUT_CLASS}
            >
              <option value="">— No category —</option>
              {activeCategories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bulk-pricing" className={LABEL_CLASS}>
              Pricing
            </label>
            <select
              id="bulk-pricing"
              value={bulkDefaults.pricing_type === 'quote' ? 'average' : bulkDefaults.pricing_type}
              onChange={(e) =>
                setBulkDefaults((d) => ({
                  ...d,
                  pricing_type: e.target.value,
                  show_price: e.target.value === 'fixed' ? d.show_price : true,
                }))
              }
              className={INPUT_CLASS}
            >
              <option value="fixed">Fixed price</option>
              <option value="range">Price range (quote before confirm)</option>
              <option value="average">Typical price (quote before confirm)</option>
            </select>
          </div>
          <div>
            <label htmlFor="bulk-duration" className={LABEL_CLASS}>
              Duration (hours)
            </label>
            <input
              id="bulk-duration"
              type="number"
              min={0.25}
              step={0.25}
              value={bulkDefaults.duration_hours}
              onChange={(e) =>
                setBulkDefaults((d) => ({ ...d, duration_hours: e.target.value }))
              }
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className={LABEL_CLASS}>Where are these jobs done?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${
                bulkDefaults.fulfillment_kind === 'mobile'
                  ? 'border-luminexa-accent bg-violet-50/80 ring-1 ring-luminexa-accent/20'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <input
                type="radio"
                name="bulk_fulfillment_kind"
                checked={bulkDefaults.fulfillment_kind === 'mobile'}
                onChange={() => setBulkDefaults((d) => ({ ...d, fulfillment_kind: 'mobile' }))}
                className="mt-0.5 accent-luminexa-accent"
              />
              <span>
                <span className="font-semibold text-slate-900">Mobile</span>
                <span className="mt-0.5 block text-xs text-slate-500">You go to the customer</span>
              </span>
            </label>
            <label
              className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${
                bulkDefaults.fulfillment_kind === 'shop'
                  ? 'border-luminexa-accent bg-violet-50/80 ring-1 ring-luminexa-accent/20'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <input
                type="radio"
                name="bulk_fulfillment_kind"
                checked={bulkDefaults.fulfillment_kind === 'shop'}
                onChange={() => setBulkDefaults((d) => ({ ...d, fulfillment_kind: 'shop' }))}
                className="mt-0.5 accent-luminexa-accent"
              />
              <span>
                <span className="font-semibold text-slate-900">In-shop</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Customer comes to your shop
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          {bulkDefaults.pricing_type === 'fixed' && (
            <FieldToggle
              checked={bulkDefaults.show_price}
              onChange={(val) => setBulkDefaults((d) => ({ ...d, show_price: val }))}
              label="Show price on public page"
            />
          )}
          <FieldToggle
            checked={bulkDefaults.allow_request}
            onChange={(val) => setBulkDefaults((d) => ({ ...d, allow_request: val }))}
            label="Allow “Request service” from customers"
            description="Customers can ask without picking a time first."
            info="Use this when you want to talk first, then set the appointment yourself. The customer sends a request; you consult them and choose a time. Calendar booking can still be available for people who prefer to book a slot."
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Services</p>
          {bulkRows.map((row, index) => (
            <div
              key={`bulk-row-${index}`}
              className="rounded-xl border border-slate-200 bg-slate-50/50 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
                {bulkRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBulkRows((rows) => rows.filter((_, i) => i !== index))}
                    className="text-xs font-medium text-slate-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={LABEL_CLASS} htmlFor={`bulk-name-${index}`}>
                    Name
                  </label>
                  <input
                    id={`bulk-name-${index}`}
                    value={row.name}
                    onChange={(e) => updateRow(index, { name: e.target.value })}
                    placeholder="e.g. Oil change"
                    className={INPUT_CLASS}
                  />
                </div>
                <>
                    <div>
                      <label className={LABEL_CLASS} htmlFor={`bulk-price-${index}`}>
                        {bulkDefaults.pricing_type === 'range'
                          ? 'From ($)'
                          : bulkDefaults.pricing_type === 'average'
                            ? 'Typical ($)'
                            : 'Rate ($)'}
                      </label>
                      <input
                        id={`bulk-price-${index}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.base_price}
                        onChange={(e) => updateRow(index, { base_price: e.target.value })}
                        placeholder="0.00"
                        className={INPUT_CLASS}
                      />
                    </div>
                    {bulkDefaults.pricing_type === 'range' && (
                      <div>
                        <label className={LABEL_CLASS} htmlFor={`bulk-price-max-${index}`}>
                          To ($)
                        </label>
                        <input
                          id={`bulk-price-max-${index}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.price_max}
                          onChange={(e) => updateRow(index, { price_max: e.target.value })}
                          placeholder="0.00"
                          className={INPUT_CLASS}
                        />
                      </div>
                    )}
                  </>
                <div className="sm:col-span-2">
                  <label className={LABEL_CLASS} htmlFor={`bulk-desc-${index}`}>
                    Description (optional)
                  </label>
                  <input
                    id={`bulk-desc-${index}`}
                    value={row.description}
                    onChange={(e) => updateRow(index, { description: e.target.value })}
                    placeholder="Short note for customers"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setBulkRows((rows) => [...rows, emptyBulkRow()])}
            className="w-full min-h-[44px] rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-700 hover:border-luminexa-accent/50 hover:bg-violet-50/40"
          >
            + Add another row
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
        <button
          type="submit"
          disabled={savingService || namedCount === 0}
          className="min-h-[44px] flex-1 rounded-lg bg-luminexa-accent font-medium text-white transition hover:bg-luminexa-accent/90 disabled:opacity-60"
        >
          {savingService
            ? 'Creating…'
            : namedCount === 1
              ? 'Create 1 service'
              : `Create ${namedCount} services`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ServiceTile({ service, detailsOpen, onDetails, onHide, onShow, orgSlug }) {
  const meta = formatServiceMeta(service, undefined, { forceShowPrice: true });
  const hidden = service.is_active === false;
  const needsDetails = serviceNeedsDetails(service);
  const duration = formatDurationLabel(service.duration_minutes);
  const locationLabel = service.fulfillment_kind === 'shop' ? 'In-shop' : 'Mobile';
  const description = (service.description || '').trim();
  const priceLabel = meta ? meta.split(' · ')[0] : null;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-lx-soft transition ${
        detailsOpen
          ? 'border-teal-600 ring-2 ring-teal-600/15'
          : hidden
            ? 'border-dashed border-slate-200 bg-slate-50/80'
            : 'border-luminexa-line hover:border-teal-200'
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-slate-900">{service.name}</h3>
              {hidden && (
                <span className="rounded-lg bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  Hidden
                </span>
              )}
              {needsDetails && !hidden && (
                <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
                  Needs details
                </span>
              )}
            </div>
            {service.rating_summary?.count > 0 && (
              <div className="mt-1.5">
                <ServiceRatingSummary summary={service.rating_summary} compact />
              </div>
            )}
            {description ? (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            ) : (
              <p className="mt-2 text-sm italic text-slate-400">No description yet</p>
            )}
          </div>
          {priceLabel && (
            <p className="shrink-0 text-right text-sm font-bold tabular-nums text-slate-900">
              {priceLabel}
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {duration && <span className="rounded-lg bg-slate-100 px-2 py-1">{duration}</span>}
          <span className="rounded-lg bg-slate-100 px-2 py-1">{locationLabel}</span>
          {service.pricing_type === 'range' ||
          service.pricing_type === 'average' ||
          service.pricing_type === 'quote' ? (
            <span className="rounded-lg bg-teal-50 px-2 py-1 text-teal-800">Quote</span>
          ) : (
            <span className="rounded-lg bg-slate-100 px-2 py-1">Fixed</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => onDetails(service)}
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition ${
            detailsOpen
              ? 'bg-teal-700 text-white'
              : needsDetails
                ? 'bg-teal-700 text-white hover:bg-teal-800'
                : 'border border-slate-200 bg-white text-slate-800 hover:border-teal-300'
          }`}
        >
          {detailsOpen ? 'Close' : needsDetails ? 'Complete details' : 'Edit'}
        </button>
        {orgSlug && !hidden && (
          <Link
            to={serviceDetail(orgSlug, service.id)}
            className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-teal-300"
          >
            Preview
          </Link>
        )}
        {hidden ? (
          <button
            type="button"
            onClick={() => onShow(service)}
            className="inline-flex min-h-[40px] items-center rounded-xl border border-emerald-200 bg-white px-3.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            Show on catalog
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onHide(service)}
            className="ml-auto inline-flex min-h-[40px] items-center rounded-xl border border-transparent px-3.5 text-sm font-semibold text-slate-500 transition hover:border-slate-200 hover:bg-white"
          >
            Hide
          </button>
        )}
      </div>
    </article>
  );
}

function ServicesSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading services">
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-28 shrink-0 animate-pulse rounded-xl bg-slate-200/80" />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5">
          <div className="flex justify-between gap-3">
            <div className="h-5 w-40 rounded-lg bg-slate-200/80" />
            <div className="h-5 w-16 rounded-lg bg-slate-200/80" />
          </div>
          <div className="mt-3 h-4 w-full max-w-md rounded-lg bg-slate-100" />
          <div className="mt-4 flex gap-2">
            <div className="h-7 w-16 rounded-lg bg-slate-100" />
            <div className="h-7 w-16 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProviderServicesPage({ embedded = false }) {
  const { orgSlug, activeOrg } = useProviderOrg();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = activeOrg?.organization;
  const fromSetup = searchParams.get('from') === 'setup';
  const showSetupContinue =
    !embedded &&
    Boolean(orgSlug) &&
    (fromSetup || (!hasFinishedProviderSetupWizard(orgSlug) && !isProviderWizardStepDone(orgSlug, 'services')));
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [serviceDraft, setServiceDraft] = useState(emptyServiceDraft);
  const [bulkDefaults, setBulkDefaults] = useState(() => emptyBulkDefaults());
  const [bulkRows, setBulkRows] = useState(() => [
    emptyBulkRow(),
    emptyBulkRow(),
    emptyBulkRow(),
  ]);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [expandedServiceId, setExpandedServiceId] = useState(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const publicCatalogPath = useMemo(
    () => (orgSlug ? publicServicesCatalog(orgSlug) : null),
    [orgSlug]
  );

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    try {
      const [catRes, svcRes] = await Promise.all([
        jobsAPI.listServiceCategories({ organization: orgSlug }),
        jobsAPI.listServices({ organization: orgSlug }),
      ]);
      setCategories(
        Array.isArray(catRes.data) ? catRes.data : catRes.data?.results || []
      );
      setServices(
        Array.isArray(svcRes.data) ? svcRes.data : svcRes.data?.results || []
      );
      setError(null);
    } catch {
      setError('Could not load services.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.is_active !== false),
    [categories]
  );

  const categoryTiles = useMemo(() => {
    const activeServices = services.filter((s) => s.is_active !== false);
    return activeCategories
      .map((cat) => ({
        ...cat,
        count: activeServices.filter((s) => s.category === cat.id).length,
      }))
      .filter((cat) => cat.count > 0);
  }, [activeCategories, services]);

  const allActiveCount = useMemo(
    () => services.filter((s) => s.is_active !== false).length,
    [services]
  );

  const uncategorizedCount = useMemo(
    () =>
      services.filter((s) => s.is_active !== false && !s.category).length,
    [services]
  );

  const visibleServices = useMemo(() => {
    if (selectedCategoryId === 'uncategorized') {
      return services.filter((s) => s.is_active !== false && !s.category);
    }
    if (selectedCategoryId) {
      return services.filter(
        (s) => s.is_active !== false && s.category === selectedCategoryId
      );
    }
    return services.filter((s) => s.is_active !== false);
  }, [services, selectedCategoryId]);

  const hiddenServices = useMemo(
    () => services.filter((s) => s.is_active === false),
    [services]
  );

  const openServiceDraft = (svc) => {
    setEditingServiceId(svc?.id ?? null);
    setShowServiceForm(true);
    setServiceDraft(
      svc
        ? {
            name: svc.name || '',
            description: svc.description || '',
            category: svc.category ? String(svc.category) : '',
            duration_hours: hoursFromMinutes(svc.duration_minutes ?? 60),
            pricing_type: svc.pricing_type === 'quote' ? 'average' : svc.pricing_type || 'fixed',
            base_price: String(
              svc.base_price != null && Number(svc.base_price) > 0 ? svc.base_price : ''
            ),
            price_max: svc.price_max != null ? String(svc.price_max) : '',
            quote_questions:
              Array.isArray(svc.quote_questions) && svc.quote_questions.length
                ? svc.quote_questions.map((q) =>
                    typeof q === 'string' ? q : q?.question || ''
                  )
                : [''],
            show_price: svc.show_price !== false,
            allow_request: svc.allow_request !== false,
            fulfillment_kind: svc.fulfillment_kind === 'shop' ? 'shop' : 'mobile',
          }
        : {
            ...emptyServiceDraft(),
            category:
              selectedCategoryId && selectedCategoryId !== 'uncategorized'
                ? String(selectedCategoryId)
                : '',
          }
    );
  };

  const toggleServiceDetails = (svc) => {
    if (expandedServiceId === svc.id && showServiceForm) {
      resetServiceForm();
      return;
    }
    setExpandedServiceId(svc.id);
    openServiceDraft(svc);
  };

  const startAddService = () => {
    setEditingServiceId(null);
    setExpandedServiceId('new');
    setShowServiceForm(true);
    setServiceDraft(emptyServiceDraft());
    const category =
      selectedCategoryId && selectedCategoryId !== 'uncategorized'
        ? String(selectedCategoryId)
        : '';
    setBulkDefaults(emptyBulkDefaults(category));
    setBulkRows([emptyBulkRow(), emptyBulkRow(), emptyBulkRow()]);
  };

  const resetServiceForm = () => {
    setEditingServiceId(null);
    setExpandedServiceId(null);
    setShowServiceForm(false);
    setServiceDraft(emptyServiceDraft());
    setBulkDefaults(emptyBulkDefaults());
    setBulkRows([emptyBulkRow(), emptyBulkRow(), emptyBulkRow()]);
  };

  const saveService = async (e) => {
    e.preventDefault();
    if (!orgSlug || !orgId) return;
    const name = serviceDraft.name.trim();
    if (name.length < 2) {
      setError('Service name is required.');
      return;
    }
    const needsQuote =
      serviceDraft.pricing_type === 'range' ||
      serviceDraft.pricing_type === 'average' ||
      serviceDraft.pricing_type === 'quote';
    if (needsQuote && !(Number(serviceDraft.base_price) > 0)) {
      setError(
        serviceDraft.pricing_type === 'range'
          ? 'Enter the low end of your price range.'
          : 'Enter a typical price so customers see an estimate.'
      );
      return;
    }
    if (
      serviceDraft.pricing_type === 'range' &&
      !(Number(serviceDraft.price_max) >= Number(serviceDraft.base_price))
    ) {
      setError('Range “To” must be at least the “From” amount.');
      return;
    }
    setSavingService(true);
    setError(null);
    const payload = {
      name,
      description: serviceDraft.description.trim(),
      category: serviceDraft.category ? Number(serviceDraft.category) : null,
      duration_minutes: minutesFromHours(serviceDraft.duration_hours),
      pricing_type: serviceDraft.pricing_type,
      base_price: serviceDraft.base_price || '0',
      price_max:
        serviceDraft.pricing_type === 'range' && serviceDraft.price_max
          ? serviceDraft.price_max
          : null,
      quote_questions: needsQuote
        ? (serviceDraft.quote_questions || []).map((q) => q.trim()).filter(Boolean)
        : [],
      show_price: needsQuote ? true : serviceDraft.show_price,
      allow_request: serviceDraft.allow_request,
      fulfillment_kind: serviceDraft.fulfillment_kind === 'shop' ? 'shop' : 'mobile',
      is_active: true,
    };
    try {
      const wasEdit = Boolean(editingServiceId);
      if (editingServiceId) {
        await jobsAPI.patchService(editingServiceId, payload);
      } else {
        await jobsAPI.createService({
          ...payload,
          organization: orgId,
          sort_order: services.length,
        });
      }
      resetServiceForm();
      setMessage(wasEdit ? 'Service details saved.' : 'Service added.');
      await load();
    } catch (err) {
      const d = err.response?.data;
      setError(
        d?.detail ||
          d?.price_max?.[0] ||
          d?.name?.[0] ||
          'Could not save service.'
      );
    } finally {
      setSavingService(false);
    }
  };

  const saveBulkServices = async (e) => {
    e.preventDefault();
    if (!orgSlug || !orgId) return;
    const rows = bulkRows
      .map((row) => ({
        name: row.name.trim(),
        description: (row.description || '').trim(),
        base_price: row.base_price,
        price_max: row.price_max,
      }))
      .filter((row) => row.name.length >= 2);

    if (rows.length === 0) {
      setError('Enter at least one service name (2+ characters).');
      return;
    }

    if (bulkDefaults.pricing_type === 'range') {
      const bad = rows.find(
        (row) => !row.price_max || Number(row.price_max) < Number(row.base_price || 0)
      );
      if (bad) {
        setError(`“${bad.name}” needs a valid price range (To ≥ From).`);
        return;
      }
    }
    if (
      bulkDefaults.pricing_type === 'average' ||
      bulkDefaults.pricing_type === 'range'
    ) {
      const bad = rows.find((row) => !(Number(row.base_price) > 0));
      if (bad) {
        setError(
          bulkDefaults.pricing_type === 'range'
            ? `“${bad.name}” needs a From price.`
            : `“${bad.name}” needs a typical price.`
        );
        return;
      }
    }

    setSavingService(true);
    setError(null);
    const category = bulkDefaults.category ? Number(bulkDefaults.category) : null;
    const duration = minutesFromHours(bulkDefaults.duration_hours);
    const needsQuote =
      bulkDefaults.pricing_type === 'range' ||
      bulkDefaults.pricing_type === 'average' ||
      bulkDefaults.pricing_type === 'quote';
    let sortBase = services.length;
    let created = 0;
    const failures = [];

    for (const row of rows) {
      try {
        await jobsAPI.createService({
          organization: orgId,
          name: row.name,
          description: row.description,
          category,
          duration_minutes: duration,
          pricing_type: bulkDefaults.pricing_type,
          base_price: row.base_price || '0',
          price_max:
            bulkDefaults.pricing_type === 'range' && row.price_max
              ? row.price_max
              : null,
          show_price: needsQuote ? true : bulkDefaults.show_price,
          allow_request: bulkDefaults.allow_request,
          fulfillment_kind: bulkDefaults.fulfillment_kind === 'shop' ? 'shop' : 'mobile',
          is_active: true,
          sort_order: sortBase,
        });
        sortBase += 1;
        created += 1;
      } catch (err) {
        const d = err.response?.data;
        failures.push(
          d?.detail ||
            d?.base_price?.[0] ||
            d?.price_max?.[0] ||
            d?.name?.[0] ||
            `Could not create “${row.name}”.`
        );
      }
    }

    setSavingService(false);
    if (created > 0) {
      resetServiceForm();
      setMessage(
        created === 1 ? '1 service created.' : `${created} services created.`
      );
      await load();
    }
    if (failures.length > 0) {
      setError(
        created > 0
          ? `${created} created, ${failures.length} failed: ${failures[0]}`
          : failures[0]
      );
    }
  };

  const toggleServicePublic = async (svc, visible) => {
    try {
      await jobsAPI.patchService(svc.id, { is_active: visible });
      setMessage(visible ? `"${svc.name}" is on your public catalog.` : `"${svc.name}" hidden.`);
      await load();
    } catch {
      setError('Could not update service.');
    }
  };

  const selectedCategoryLabel = useMemo(() => {
    if (!selectedCategoryId) return 'All services';
    if (selectedCategoryId === 'uncategorized') return 'Other services';
    return activeCategories.find((c) => c.id === selectedCategoryId)?.name || 'Services';
  }, [selectedCategoryId, activeCategories]);

  return (
    <div className="space-y-6">
      {showSetupContinue && (
        <section className="rounded-2xl border border-teal-200 bg-teal-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-teal-950">Business setup</p>
          <p className="mt-1 text-sm text-teal-900/80">
            Add at least one service customers can book, then continue. You can edit these anytime.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                markProviderWizardStepDone(orgSlug, 'services');
                navigate(providerSetupPath(orgSlug, 'profile'));
              }}
              className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white"
            >
              Save & continue setup
            </button>
            <button
              type="button"
              onClick={() => {
                markProviderWizardStepDone(orgSlug, 'services');
                navigate(providerSetupPath(orgSlug, 'profile'));
              }}
              className="min-h-[44px] rounded-xl border border-teal-200 bg-white px-4 text-sm font-semibold text-teal-900"
            >
              Skip & continue
            </button>
          </div>
        </section>
      )}

      {!embedded && (
        <section className="rounded-2xl border border-luminexa-line bg-white p-5 shadow-lx-soft sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-xl">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Services</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                What customers can book from your catalog. Edit details anytime — hide items you
                don&apos;t want shown.
              </p>
              {publicCatalogPath && (
                <Link
                  to={publicCatalogPath}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-700 transition hover:text-teal-900"
                >
                  Preview customer catalog
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={startAddService}
              className="min-h-[44px] shrink-0 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
            >
              + Add services
            </button>
          </div>
          {(message || error) && (
            <div className="mt-4 space-y-2">
              {message && (
                <p
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                >
                  {message}
                </p>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                >
                  {error}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {embedded && (message || error) && (
        <div className="space-y-2">
          {message && (
            <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <ServicesSkeleton />
      ) : (
        <>
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Filter by category</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Categories come from Luminexa. Pick one when you add a service.
                </p>
              </div>
              <p className="text-xs font-medium tabular-nums text-slate-500">
                {allActiveCount} live{hiddenServices.length > 0 ? ` · ${hiddenServices.length} hidden` : ''}
              </p>
            </div>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
              <FilterChip
                label="All"
                count={allActiveCount}
                selected={selectedCategoryId === null}
                onClick={() => setSelectedCategoryId(null)}
              />
              {categoryTiles.map((cat) => (
                <FilterChip
                  key={cat.id}
                  label={cat.name}
                  count={cat.count}
                  selected={selectedCategoryId === cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                />
              ))}
              {uncategorizedCount > 0 && (
                <FilterChip
                  label="Uncategorized"
                  count={uncategorizedCount}
                  selected={selectedCategoryId === 'uncategorized'}
                  onClick={() => setSelectedCategoryId('uncategorized')}
                />
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-bold tracking-tight text-slate-900">
                {selectedCategoryLabel}
              </h3>
              {visibleServices.length > 0 && (
                <button
                  type="button"
                  onClick={startAddService}
                  className="text-sm font-semibold text-teal-700 transition hover:text-teal-900"
                >
                  + Add more
                </button>
              )}
            </div>

            {showServiceForm && expandedServiceId === 'new' && (
              <div className="mb-4">
                <BulkAddServicesForm
                  bulkDefaults={bulkDefaults}
                  setBulkDefaults={setBulkDefaults}
                  bulkRows={bulkRows}
                  setBulkRows={setBulkRows}
                  activeCategories={activeCategories}
                  savingService={savingService}
                  onSubmit={saveBulkServices}
                  onCancel={resetServiceForm}
                />
              </div>
            )}

            {visibleServices.length > 0 ? (
              <div className="space-y-3">
                {visibleServices.map((svc) => (
                  <div key={svc.id} className="space-y-2">
                    <ServiceTile
                      service={svc}
                      orgSlug={orgSlug}
                      detailsOpen={expandedServiceId === svc.id && showServiceForm}
                      onDetails={toggleServiceDetails}
                      onHide={(s) => toggleServicePublic(s, false)}
                      onShow={(s) => toggleServicePublic(s, true)}
                    />
                    {expandedServiceId === svc.id && showServiceForm && (
                      <ServiceDetailForm
                        serviceDraft={serviceDraft}
                        setServiceDraft={setServiceDraft}
                        activeCategories={activeCategories}
                        editingServiceId={editingServiceId}
                        savingService={savingService}
                        onSubmit={saveService}
                        onCancel={resetServiceForm}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50 px-6 py-12 text-center">
                <p className="text-base font-semibold text-slate-900">
                  {selectedCategoryId ? 'Nothing in this category yet' : 'No services yet'}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                  {selectedCategoryId
                    ? 'Add a service here, or switch to All to see your full catalog.'
                    : 'Add what you offer — name, price or quote, and duration. Customers book from this list.'}
                </p>
                <button
                  type="button"
                  onClick={startAddService}
                  className="mt-5 min-h-[44px] rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
                >
                  + Add services
                </button>
              </div>
            )}

            {hiddenServices.length > 0 && (
              <div className="mt-8 border-t border-slate-100 pt-6">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Hidden from customers</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Still in your account — restore anytime with Show on catalog.
                  </p>
                </div>
                <div className="space-y-3">
                  {hiddenServices.map((svc) => (
                    <div key={svc.id} className="space-y-2">
                      <ServiceTile
                        service={svc}
                        orgSlug={orgSlug}
                        detailsOpen={expandedServiceId === svc.id && showServiceForm}
                        onDetails={toggleServiceDetails}
                        onHide={() => {}}
                        onShow={(s) => toggleServicePublic(s, true)}
                      />
                      {expandedServiceId === svc.id && showServiceForm && (
                        <ServiceDetailForm
                          serviceDraft={serviceDraft}
                          setServiceDraft={setServiceDraft}
                          activeCategories={activeCategories}
                          editingServiceId={editingServiceId}
                          savingService={savingService}
                          onSubmit={saveService}
                          onCancel={resetServiceForm}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {showSetupContinue && (
        <div className="sticky bottom-20 z-30 rounded-2xl border border-teal-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-4">
          <button
            type="button"
            onClick={() => {
              markProviderWizardStepDone(orgSlug, 'services');
              navigate(providerSetupPath(orgSlug, 'profile'));
            }}
            className="lx-btn-primary min-h-[48px] w-full"
          >
            Continue setup
          </button>
        </div>
      )}
    </div>
  );
}
