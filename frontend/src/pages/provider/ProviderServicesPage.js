import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { publicServicesCatalog, serviceDetail } from '../../utils/customerPaths';
import ServiceGalleryEditor from '../../components/services/ServiceGalleryEditor';
import ServiceRatingSummary from '../../components/services/ServiceRatingSummary';
import { formatServiceMeta } from '../../utils/serviceDisplay';

const CATEGORY_PRESETS = ['Automobile', 'House work', 'Beauty & wellness', 'Outdoor & garden'];

const INPUT_CLASS =
  'w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-luminexa-accent focus:outline-none focus:ring-2 focus:ring-luminexa-accent/20';
const LABEL_CLASS = 'mb-1 block text-xs font-medium text-slate-600';

function FieldToggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-luminexa-accent/40"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
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
  );
}

const emptyServiceDraft = () => ({
  name: '',
  description: '',
  category: '',
  duration_minutes: '60',
  pricing_type: 'fixed',
  base_price: '0',
  price_max: '',
  show_price: true,
  allow_request: true,
});

function CategoryTile({ label, count, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[100px] flex-col justify-between rounded-xl border p-4 text-left shadow-sm transition ${
        selected
          ? 'border-luminexa-accent bg-violet-50 ring-2 ring-luminexa-accent/30'
          : 'border-slate-200 bg-white hover:border-luminexa-accent/40 hover:shadow-md'
      }`}
    >
      <h3 className="font-semibold text-slate-900">{label}</h3>
      <p className="mt-2 text-xs font-medium text-luminexa-accent">
        {count === 1 ? '1 service' : `${count} services`}
      </p>
    </button>
  );
}

function serviceNeedsDetails(service) {
  const hasDescription = Boolean(service.description?.trim());
  const hasPricing =
    service.pricing_type === 'quote' ||
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
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-luminexa-accent/10"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
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
          </div>
          <div>
            <label htmlFor="svc-pricing" className={LABEL_CLASS}>
              Pricing
            </label>
            <select
              id="svc-pricing"
              value={serviceDraft.pricing_type}
              onChange={(e) => setServiceDraft((d) => ({ ...d, pricing_type: e.target.value }))}
              className={INPUT_CLASS}
            >
              <option value="fixed">Fixed price</option>
              <option value="range">Price range</option>
              <option value="quote">Quote on request</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {serviceDraft.pricing_type !== 'quote' && (
            <>
              <div>
                <label htmlFor="svc-price" className={LABEL_CLASS}>
                  {serviceDraft.pricing_type === 'range' ? 'From ($)' : 'Rate ($)'}
                </label>
                <input
                  id="svc-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={serviceDraft.base_price}
                  onChange={(e) => setServiceDraft((d) => ({ ...d, base_price: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </div>
              {serviceDraft.pricing_type === 'range' && (
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
                  />
                </div>
              )}
            </>
          )}
          <div>
            <label htmlFor="svc-duration" className={LABEL_CLASS}>
              Duration (minutes)
            </label>
            <input
              id="svc-duration"
              type="number"
              min={15}
              step={15}
              value={serviceDraft.duration_minutes}
              onChange={(e) => setServiceDraft((d) => ({ ...d, duration_minutes: e.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="space-y-2">
          <FieldToggle
            checked={serviceDraft.show_price}
            onChange={(val) => setServiceDraft((d) => ({ ...d, show_price: val }))}
            label="Show price on public page"
            description="Display this service's price to customers browsing your catalog."
          />
          <FieldToggle
            checked={serviceDraft.allow_request}
            onChange={(val) => setServiceDraft((d) => ({ ...d, allow_request: val }))}
            label="Allow “Request service” from customers"
            description="Let customers request this service directly from your page."
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

function ServiceTile({ service, editing, detailsOpen, onDetails, onHide, onShow, orgSlug }) {
  const meta = formatServiceMeta(service, undefined, { forceShowPrice: true });
  const hidden = service.is_active === false;
  const needsDetails = serviceNeedsDetails(service);

  return (
    <div
      className={`flex min-h-[120px] flex-col justify-between rounded-xl border p-4 shadow-sm ${
        detailsOpen
          ? 'border-luminexa-accent ring-2 ring-luminexa-accent/20'
          : hidden
            ? 'border-dashed border-slate-200 bg-slate-50'
            : 'border-slate-200 bg-white'
      }`}
    >
      <div>
        <h3 className="font-semibold text-slate-900">{service.name}</h3>
        {service.rating_summary?.count > 0 && (
          <div className="mt-1">
            <ServiceRatingSummary summary={service.rating_summary} compact />
          </div>
        )}
        {meta && <p className="mt-2 text-xs font-medium text-slate-700">{meta}</p>}
        {orgSlug && !hidden && (
          <Link
            to={serviceDetail(orgSlug, service.id)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-luminexa-accent transition hover:gap-1.5"
          >
            Show full details
            <span aria-hidden="true">→</span>
          </Link>
        )}
        {hidden && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            Hidden from customers
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => onDetails(service)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            detailsOpen
              ? 'bg-luminexa-accent text-white'
              : needsDetails
                ? 'border border-violet-200 bg-violet-50 text-luminexa-accent hover:bg-violet-100'
                : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {needsDetails && !detailsOpen && (
            <span className="h-1.5 w-1.5 rounded-full bg-luminexa-accent" aria-hidden="true" />
          )}
          {detailsOpen ? 'Close details' : needsDetails ? 'Add details' : 'Edit details'}
        </button>
        {editing &&
          (hidden ? (
            <button
              type="button"
              onClick={() => onShow(service)}
              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
            >
              Show
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onHide(service)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
            >
              Hide
            </button>
          ))}
      </div>
    </div>
  );
}

export default function ProviderServicesPage({ embedded = false }) {
  const { orgSlug, activeOrg } = useProviderOrg();
  const orgId = activeOrg?.organization;
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(embedded);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [serviceDraft, setServiceDraft] = useState(emptyServiceDraft);
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
    return activeCategories.map((cat) => ({
      ...cat,
      count: activeServices.filter((s) => s.category === cat.id).length,
    }));
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

  const addCategory = async (name) => {
    const trimmed = (name || categoryName).trim();
    if (!orgSlug || !orgId || trimmed.length < 2) return;
    setSavingCategory(true);
    setError(null);
    try {
      await jobsAPI.createServiceCategory({
        organization: orgId,
        name: trimmed,
        sort_order: categories.length,
      });
      setCategoryName('');
      setShowAddCategory(false);
      setMessage(`Category "${trimmed}" added.`);
      await load();
    } catch (err) {
      const d = err.response?.data;
      setError(d?.name?.[0] || d?.detail || 'Could not add category.');
    } finally {
      setSavingCategory(false);
    }
  };

  const openServiceDraft = (svc) => {
    setEditingServiceId(svc?.id ?? null);
    setShowServiceForm(true);
    setServiceDraft(
      svc
        ? {
            name: svc.name || '',
            description: svc.description || '',
            category: svc.category ? String(svc.category) : '',
            duration_minutes: String(svc.duration_minutes ?? 60),
            pricing_type: svc.pricing_type || 'fixed',
            base_price: String(svc.base_price ?? '0'),
            price_max: svc.price_max != null ? String(svc.price_max) : '',
            show_price: svc.show_price !== false,
            allow_request: svc.allow_request !== false,
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
    setExpandedServiceId('new');
    openServiceDraft(null);
  };

  const resetServiceForm = () => {
    setEditingServiceId(null);
    setExpandedServiceId(null);
    setShowServiceForm(false);
    setServiceDraft(emptyServiceDraft());
  };

  const saveService = async (e) => {
    e.preventDefault();
    if (!orgSlug || !orgId) return;
    const name = serviceDraft.name.trim();
    if (name.length < 2) {
      setError('Service name is required.');
      return;
    }
    setSavingService(true);
    setError(null);
    const payload = {
      name,
      description: serviceDraft.description.trim(),
      category: serviceDraft.category ? Number(serviceDraft.category) : null,
      duration_minutes: Number(serviceDraft.duration_minutes) || 60,
      pricing_type: serviceDraft.pricing_type,
      base_price: serviceDraft.base_price || '0',
      price_max:
        serviceDraft.pricing_type === 'range' && serviceDraft.price_max
          ? serviceDraft.price_max
          : null,
      show_price: serviceDraft.show_price,
      allow_request: serviceDraft.allow_request,
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
      {!embedded && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase text-slate-500">Service catalog</h2>
              <p className="mt-1 text-sm text-slate-600">
                Browse your categories and services. Tap <strong>Edit</strong> when you need to add or
                change something.
              </p>
              {publicCatalogPath && (
                <Link
                  to={publicCatalogPath}
                  className="mt-2 inline-block text-sm font-medium text-luminexa-accent"
                >
                  Preview customer catalog →
                </Link>
              )}
            </div>
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="min-h-[44px] shrink-0 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700"
              >
                Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setShowAddCategory(false);
                  resetServiceForm();
                }}
                className="min-h-[44px] shrink-0 rounded-xl bg-luminexa-accent px-4 text-sm font-medium text-white"
              >
                Done
              </button>
            )}
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase text-slate-500">Categories</h3>
              {editing && (
                <button
                  type="button"
                  onClick={() => setShowAddCategory((v) => !v)}
                  className="text-sm font-medium text-luminexa-accent"
                >
                  {showAddCategory ? 'Cancel' : '+ Add category'}
                </button>
              )}
            </div>

            {editing && showAddCategory && (
              <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                <p className="text-sm font-medium text-slate-800">New category</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATEGORY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={savingCategory || activeCategories.some((c) => c.name === preset)}
                      onClick={() => addCategory(preset)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addCategory();
                  }}
                >
                  <input
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Custom category name"
                    className="min-h-[44px] flex-1 rounded-lg border border-slate-200 px-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={savingCategory}
                    className="min-h-[44px] shrink-0 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Add
                  </button>
                </form>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <CategoryTile
                label="All"
                count={allActiveCount}
                selected={selectedCategoryId === null}
                onClick={() => setSelectedCategoryId(null)}
              />
              {categoryTiles.map((cat) => (
                <CategoryTile
                  key={cat.id}
                  label={cat.name}
                  count={cat.count}
                  selected={selectedCategoryId === cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                />
              ))}
              {uncategorizedCount > 0 && (
                <CategoryTile
                  label="Other"
                  count={uncategorizedCount}
                  selected={selectedCategoryId === 'uncategorized'}
                  onClick={() => setSelectedCategoryId('uncategorized')}
                />
              )}
            </div>

            {!editing && categoryTiles.length === 0 && allActiveCount === 0 && (
              <p className="mt-3 text-sm text-slate-500">
                No categories yet. Tap <strong>Edit</strong> to add your first category and services.
              </p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase text-slate-500">{selectedCategoryLabel}</h3>
              {editing && (
                <button
                  type="button"
                  onClick={startAddService}
                  className="text-sm font-medium text-luminexa-accent"
                >
                  + Add service
                </button>
              )}
            </div>

            {showServiceForm && expandedServiceId === 'new' && (
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

            {visibleServices.length > 0 ? (
              <div className="mt-3 space-y-4">
                {visibleServices.map((svc) => (
                  <div key={svc.id} className="space-y-2">
                    <ServiceTile
                      service={svc}
                      orgSlug={orgSlug}
                      editing={editing}
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
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
                <p className="text-sm text-slate-500">
                  {selectedCategoryId
                    ? 'No services in this category yet.'
                    : 'No services yet.'}
                </p>
                {editing && (
                  <button
                    type="button"
                    onClick={startAddService}
                    className="mt-3 text-sm font-medium text-luminexa-accent"
                  >
                    Add a service
                  </button>
                )}
              </div>
            )}

            {editing && hiddenServices.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <p className="text-xs font-medium uppercase text-slate-500">Hidden services</p>
                <div className="mt-3 space-y-4">
                  {hiddenServices.map((svc) => (
                    <div key={svc.id} className="space-y-2">
                      <ServiceTile
                        service={svc}
                        orgSlug={orgSlug}
                        editing
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

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
