import React from 'react';
import { policyLabel } from '../../constants/bookingPolicies';
import ExpandableText from '../ui/ExpandableText';
import ExpandablePhoto from '../ui/ExpandablePhoto';
import ExpandableGallery from '../ui/ExpandableGallery';
import ServiceCategoryBrowse from '../services/ServiceCategoryBrowse';
import { buildCatalogFromFlat } from '../services/ServiceCatalogView';
import CustomerServiceRequestForm from '../customer/CustomerServiceRequestForm';
import { formatProviderServiceArea, providerHasServiceArea } from '../../utils/serviceArea';
import { providerRequests } from '../../utils/providerPaths';
import { serviceRequiresQuote } from '../../utils/serviceDisplay';
import VisitWebsiteButton from './VisitWebsiteButton';

/**
 * Read-only customer-facing booking page preview for providers.
 */
export default function ProviderStorefrontPreview({
  data,
  loading,
  orgSlug,
  onEdit,
  showEditOnBanner = true,
}) {
  if (loading && !data) {
    return <p className="text-center text-sm text-slate-500 py-8">Loading preview…</p>;
  }

  if (!data?.organization) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Could not load your public page preview.
      </p>
    );
  }

  const { organization, services = [], booking_policy: bookingPolicy } = data;
  const serviceCatalog = data.service_catalog || buildCatalogFromFlat(services);
  const gallery = organization.gallery || [];
  const hasServices =
    services.length > 0 || serviceCatalog.categories?.some((c) => (c.services || []).length > 0);

  const renderPreviewActions = (svc) => {
    const needsQuote = serviceRequiresQuote(svc);
    return (
      <button
        type="button"
        disabled
        className={
          needsQuote
            ? 'rounded-lg bg-luminexa-accent px-3 py-2 text-sm font-medium text-white opacity-70'
            : 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 opacity-70'
        }
      >
        {needsQuote ? 'Request quote' : 'Book only this'}
      </button>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[3/1] overflow-hidden bg-gradient-to-br from-luminexa-accent/30 to-slate-200">
        {organization.banner_url && (
          <img src={organization.banner_url} alt="" className="h-full w-full object-cover" />
        )}
        {organization.logo_url && (
          <ExpandablePhoto
            src={organization.logo_url}
            alt={`${organization.name} profile photo`}
            buttonClassName="absolute bottom-3 left-4 z-[1] h-16 w-16 overflow-hidden rounded-xl border-2 border-white bg-white shadow-md cursor-zoom-in"
            imgClassName="h-full w-full object-cover"
          />
        )}
        {showEditOnBanner && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="absolute right-3 top-3 rounded-lg bg-luminexa-accent px-3 py-2 text-sm font-medium text-white shadow"
          >
            Edit page
          </button>
        )}
        <span className="absolute left-4 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          Customer view
        </span>
      </div>

      <div className="space-y-5 p-4">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">{organization.name}</h1>
          {organization.tagline && (
            <p className="mt-1 text-slate-600">{organization.tagline}</p>
          )}
          {providerHasServiceArea(organization) && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600">
              <span aria-hidden>📍</span>
              <span>{formatProviderServiceArea(organization)}</span>
            </p>
          )}
          <VisitWebsiteButton url={organization.external_website_url} className="mt-3" />
          {bookingPolicy && (
            <p className="mt-2 text-xs text-slate-500">{policyLabel(bookingPolicy)}</p>
          )}
        </header>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Choose a category</h2>
          {!hasServices ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">
                No services on your public page yet. Add categories and services in Edit page.
              </p>
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="mt-3 text-sm font-medium text-luminexa-accent"
                >
                  Edit page
                </button>
              )}
            </div>
          ) : (
            <ServiceCategoryBrowse
              catalog={serviceCatalog}
              orgSlug={orgSlug}
              forceShowPrice
              renderServiceActions={renderPreviewActions}
              emptyMessage="No services listed yet."
            />
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase text-slate-500">About</h2>
          {organization.description ? (
            <ExpandableText
              text={organization.description}
              className="mt-2 text-sm text-slate-700"
              clampClass="line-clamp-3"
              maxChars={200}
            />
          ) : (
            <p className="mt-2 text-sm italic text-slate-400">
              No description yet — tap Edit page to add your bio.
            </p>
          )}
        </section>

        {gallery.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase text-slate-500">Gallery</h2>
            <ExpandableGallery images={gallery} fallbackAlt={organization.name} />
          </section>
        )}

        <CustomerServiceRequestForm
          orgSlug={orgSlug}
          businessTypes={data.business_types || []}
          categories={serviceCatalog?.categories || []}
          previewMode
          previewRequestsHref={providerRequests(orgSlug)}
        />
      </div>
    </div>
  );
}
