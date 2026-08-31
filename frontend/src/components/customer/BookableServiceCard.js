import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BusinessTypeIcon from '../icons/BusinessTypeIcon';
import ServiceRatingSummary from '../services/ServiceRatingSummary';
import ServiceRequestModal from '../services/ServiceRequestModal';
import ServiceThumb from '../services/ServiceThumb';
import { useAuth } from '../../contexts/AuthContext';
import {
  bookService,
  customerInquiryDetail,
  customerProviderService,
  customerProviderServiceDetail,
  serviceDetail,
} from '../../utils/customerPaths';
import { formatWhen } from '../../utils/datetime';
import { providerCustomerKey } from '../../utils/providerRouteKey';
import { formatServiceCatalogLabel, serviceRequiresQuote } from '../../utils/serviceDisplay';

export default function BookableServiceCard({ service, bookTo, useCustomerProviderUrls = true }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [requestOpen, setRequestOpen] = useState(false);
  const [sentMessage, setSentMessage] = useState(null);
  const providerKey = providerCustomerKey(service);
  const needsQuote = serviceRequiresQuote(service);
  const defaultBookHref = useCustomerProviderUrls
    ? customerProviderService(providerKey, service.id)
    : bookService(providerKey, service.id);
  const bookHref = bookTo || defaultBookHref;
  const detailHref = useCustomerProviderUrls
    ? customerProviderServiceDetail(providerKey, service.id)
    : serviceDetail(providerKey, service.id);
  const types = service.business_types || [];
  const availability = service.availability;
  const catalogLabel = formatServiceCatalogLabel(service);

  const openRequest = () => {
    if (!isAuthenticated) {
      const next = `${detailHref}${detailHref.includes('?') ? '&' : '?'}action=request`;
      navigate(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setRequestOpen(true);
  };

  return (
    <article className="lx-card-interactive">
      <div className="flex gap-3">
        <ServiceThumb
          service={{
            ...service,
            category_name: service.category_name || types[0]?.name,
          }}
          slug={types[0]?.slug}
          className="h-16 w-16"
          iconClassName="h-8 w-8"
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold tracking-tight text-slate-900">{service.name}</h3>
          <p className="text-sm text-slate-600">
            {service.organization_name}
            {service.distance_miles != null && (
              <span className="text-slate-500"> · ~{service.distance_miles} mi away</span>
            )}
          </p>
          {catalogLabel && (
            <p className="mt-1 text-sm font-medium text-slate-800">{catalogLabel}</p>
          )}
          {service.rating_summary?.count > 0 && (
            <div className="mt-1">
              <ServiceRatingSummary summary={service.rating_summary} compact />
            </div>
          )}
        </div>
      </div>

      {types.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-1 text-xs text-slate-500">
          {types.map((t) => (
            <span
              key={t.slug}
              className="inline-flex items-center gap-0.5 rounded-full bg-slate-100/90 px-2 py-0.5 ring-1 ring-slate-200/60"
            >
              <BusinessTypeIcon slug={t.slug} name={t.name} className="h-3.5 w-3.5 text-teal-700" />
              {t.name}
            </span>
          ))}
        </p>
      )}

      {availability?.open_slot_count > 0 && !needsQuote && (
        <p className="mt-3 rounded-xl bg-emerald-50/90 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100/80">
          {availability.open_slot_count === 1
            ? '1 free slot'
            : `${availability.open_slot_count} free slots`}
          {availability.first_available_at
            ? ` · Next ${formatWhen(availability.first_available_at)}`
            : ''}
        </p>
      )}

      {sentMessage && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{sentMessage}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100/80 pt-3">
        <div className="flex shrink-0 gap-2">
          {providerKey && (
            <Link to={detailHref} className="lx-btn-secondary min-h-[40px] px-3">
              Full details
            </Link>
          )}
          {needsQuote ? (
            <button
              type="button"
              onClick={openRequest}
              className="lx-btn-primary min-h-[40px] px-4"
            >
              Request quote
            </button>
          ) : (
            <Link to={bookHref} className="lx-btn-primary min-h-[40px] px-4">
              Book
            </Link>
          )}
        </div>
      </div>

      {requestOpen && (
        <ServiceRequestModal
          orgSlug={providerKey}
          service={service}
          onClose={() => setRequestOpen(false)}
          onSuccess={(inquiry) => {
            setRequestOpen(false);
            if (inquiry?.id) {
              navigate(customerInquiryDetail(inquiry.id));
              return;
            }
            setSentMessage(
              `Quote request sent. ${service.organization_name || 'The business'} will reply with a price.`
            );
          }}
        />
      )}
    </article>
  );
}
