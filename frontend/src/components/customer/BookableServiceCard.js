import React from 'react';
import { Link } from 'react-router-dom';
import ServiceRatingSummary from '../services/ServiceRatingSummary';
import {
  bookService,
  customerProviderService,
  customerProviderServiceDetail,
  serviceDetail,
} from '../../utils/customerPaths';
import { formatWhen } from '../../utils/datetime';
import { providerCustomerKey } from '../../utils/providerRouteKey';
import { formatServiceMeta } from '../../utils/serviceDisplay';

export default function BookableServiceCard({ service, bookTo, useCustomerProviderUrls = true }) {
  const providerKey = providerCustomerKey(service);
  const defaultBookHref = useCustomerProviderUrls
    ? customerProviderService(providerKey, service.id)
    : bookService(providerKey, service.id);
  const bookHref = bookTo || defaultBookHref;
  const detailHref = useCustomerProviderUrls
    ? customerProviderServiceDetail(providerKey, service.id)
    : serviceDetail(providerKey, service.id);
  const types = service.business_types || [];
  const location = service.location || service.location_short;
  const availability = service.availability;

  return (
    <article className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        {service.image_url ? (
          <img
            src={service.image_url}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl">
            {types[0]?.icon || '🔧'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">{service.name}</h3>
          <p className="text-sm text-slate-600">{service.organization_name}</p>
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
              className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5"
            >
              {t.icon && <span aria-hidden>{t.icon}</span>}
              {t.name}
            </span>
          ))}
        </p>
      )}

      {location ? (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600">
          <span className="shrink-0 text-base" aria-hidden>
            📍
          </span>
          <span>
            {location}
            {service.distance_miles != null && (
              <span className="text-slate-500"> · ~{service.distance_miles} mi away</span>
            )}
          </span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-400">Location not listed</p>
      )}

      {availability?.open_slot_count > 0 && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          {availability.open_slot_count === 1
            ? '1 free slot'
            : `${availability.open_slot_count} free slots`}
          {availability.first_available_at
            ? ` · Next ${formatWhen(availability.first_available_at)}`
            : ''}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        {formatServiceMeta(service) && (
          <p className="text-xs text-slate-500">{formatServiceMeta(service)}</p>
        )}
        <div className="flex shrink-0 gap-2">
          {providerKey && (
            <Link
              to={detailHref}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-luminexa-accent px-3 text-sm font-medium text-luminexa-accent"
            >
              Full details
            </Link>
          )}
          <Link
            to={bookHref}
            className="inline-flex min-h-[40px] items-center rounded-lg bg-luminexa-accent px-4 text-sm font-medium text-white"
          >
            Book
          </Link>
        </div>
      </div>
    </article>
  );
}
