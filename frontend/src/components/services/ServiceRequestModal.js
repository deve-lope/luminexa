import React, { useEffect, useId, useState } from 'react';
import BookingServiceLocationSection from '../customer/BookingServiceLocationSection';
import CustomerServiceDetailsForm from '../customer/CustomerServiceDetailsForm';
import ServiceAvailabilityPreview from '../booking/ServiceAvailabilityPreview';
import ModalOverlay from '../ui/ModalOverlay';
import { useAuth } from '../../contexts/AuthContext';
import { businessesAPI } from '../../utils/api';
import {
  formatFulfillmentDescription,
  isShopService,
  serviceRequiresQuote,
} from '../../utils/serviceDisplay';

function parseError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Could not send your request.';
}

/**
 * Quote-first / custom service request — no calendar slot is held.
 * Provider responds with a quote; scheduling happens after they agree on price.
 */
export default function ServiceRequestModal({ orgSlug, service, onClose, onSuccess }) {
  const titleId = useId();
  const { user } = useAuth();
  const needsQuote = serviceRequiresQuote(service);
  const [message, setMessage] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [serviceAddress, setServiceAddress] = useState(
    () => (user?.default_service_address || '').trim()
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const shop = isShopService(service);
  const shopLocation = (service?.shop_location || '').trim();

  useEffect(() => {
    const saved = (user?.default_service_address || '').trim();
    if (saved && !serviceAddress) {
      setServiceAddress(saved);
    }
  }, [user?.default_service_address, serviceAddress]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (!shop && !serviceAddress.trim()) {
      setError('Please enter the job location.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        service_id: service?.id,
        service_label: service?.name || '',
        message:
          trimmed ||
          (needsQuote
            ? 'Quote request — please send pricing for this job.'
            : 'Service request'),
        service_address: shop ? shopLocation : serviceAddress.trim(),
      };
      if (preferredDate) {
        payload.preferred_date = preferredDate;
      }
      await businessesAPI.submitServiceInquiry(orgSlug, payload);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} labelledBy={titleId}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {needsQuote ? 'Request a quote' : 'Request service'}
          </h2>
          {service?.name && (
            <p className="mt-1 text-sm text-slate-600">{service.name}</p>
          )}
          {service && (
            <p className="mt-1 text-xs text-slate-500">{formatFulfillmentDescription(service)}</p>
          )}
          {needsQuote && (
            <p className="mt-2 text-sm text-slate-600">
              Tell the business what you need. They&apos;ll send a price — you pick a date after
              you accept the quote.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
        >
          Close
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 pb-safe">
        {shop ? (
          <>
            <CustomerServiceDetailsForm
              serviceLabel={service?.name || ''}
              onServiceLabelChange={() => {}}
              message={message}
              onMessageChange={setMessage}
              serviceAddress=""
              onServiceAddressChange={() => {}}
              showServiceLabel={false}
              showLocation={false}
              compact
              messagePlaceholder={
                needsQuote
                  ? 'e.g. Car make/model, oil type, anything that affects the price…'
                  : undefined
              }
            />
            <div className="rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Job location — come to the shop
              </p>
              <p className="mt-1 whitespace-pre-wrap font-medium">
                {shopLocation || 'Shop address will be confirmed by the business.'}
              </p>
            </div>
          </>
        ) : (
          <>
            <CustomerServiceDetailsForm
              serviceLabel={service?.name || ''}
              onServiceLabelChange={() => {}}
              message={message}
              onMessageChange={setMessage}
              serviceAddress={serviceAddress}
              onServiceAddressChange={setServiceAddress}
              showServiceLabel={false}
              showLocation={false}
              compact
              messagePlaceholder={
                needsQuote
                  ? 'e.g. Car make/model, oil type, anything that affects the price…'
                  : undefined
              }
            />
            <BookingServiceLocationSection
              user={user}
              value={serviceAddress}
              onChange={setServiceAddress}
            />
          </>
        )}
        <div>
          <label htmlFor="quote-preferred-date" className="mb-1 block text-sm font-medium text-slate-700">
            Preferred date <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="quote-preferred-date"
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full min-h-[44px] rounded-lg border border-slate-200 px-3"
          />
          <p className="mt-1 text-xs text-slate-500">
            A hint for the business — not a reserved appointment.
          </p>
        </div>
        {service?.id && orgSlug && (
          <ServiceAvailabilityPreview
            orgSlug={orgSlug}
            serviceId={service.id}
            compact
            hint="Open slots shown for planning — your time is not held until you accept a quote and book."
          />
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
        >
          {submitting ? 'Sending…' : needsQuote ? 'Send quote request' : 'Send request'}
        </button>
      </form>
    </ModalOverlay>
  );
}
