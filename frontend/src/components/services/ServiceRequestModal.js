import React, { useEffect, useState } from 'react';
import BookingServiceLocationSection from '../customer/BookingServiceLocationSection';
import CustomerServiceDetailsForm from '../customer/CustomerServiceDetailsForm';
import { useAuth } from '../../contexts/AuthContext';
import { businessesAPI } from '../../utils/api';
import {
  formatFulfillmentDescription,
  isShopService,
} from '../../utils/serviceDisplay';

function parseError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Could not send your request.';
}

export default function ServiceRequestModal({ orgSlug, service, onClose, onSuccess }) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
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
      await businessesAPI.submitServiceInquiry(orgSlug, {
        service_id: service?.id,
        service_label: service?.name || '',
        message: trimmed || 'Service request',
        service_address: shop ? shopLocation : serviceAddress.trim(),
      });
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Request service</h2>
            {service?.name && (
              <p className="mt-1 text-sm text-slate-600">{service.name}</p>
            )}
            {service && (
              <p className="mt-1 text-xs text-slate-500">{formatFulfillmentDescription(service)}</p>
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
              />
              <BookingServiceLocationSection
                user={user}
                value={serviceAddress}
                onChange={setServiceAddress}
              />
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send request'}
          </button>
        </form>
      </div>
    </div>
  );
}
