import React, { useState } from 'react';
import CustomerServiceDetailsForm from '../customer/CustomerServiceDetailsForm';
import { businessesAPI } from '../../utils/api';

function parseError(err) {
  const d = err.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Could not send your request.';
}

export default function ServiceRequestModal({ orgSlug, service, onClose, onSuccess }) {
  const [message, setMessage] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setError('Please describe what you need in at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await businessesAPI.submitServiceInquiry(orgSlug, {
        service_id: service?.id,
        service_label: service?.name || '',
        message: trimmed,
        service_address: serviceAddress.trim(),
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
          <CustomerServiceDetailsForm
            serviceLabel={service?.name || ''}
            onServiceLabelChange={() => {}}
            message={message}
            onMessageChange={setMessage}
            serviceAddress={serviceAddress}
            onServiceAddressChange={setServiceAddress}
            showServiceLabel={false}
            compact
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send request'}
          </button>
        </form>
      </div>
    </div>
  );
}
