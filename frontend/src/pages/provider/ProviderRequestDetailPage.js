import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BookingStatusTimeline from '../../components/booking/BookingStatusTimeline';
import RequestMessageThread from '../../components/provider/RequestMessageThread';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { useToast } from '../../contexts/ToastContext';
import { jobsAPI } from '../../utils/api';
import { formatTime, formatWhen } from '../../utils/datetime';
import parseApiError from '../../utils/parseApiError';
import { providerRequests } from '../../utils/providerPaths';
import { requestStatusLabel, requestStatusTone } from '../../utils/requestStatus';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

function DetailRow({ label, children }) {
  if (!children) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{children}</dd>
    </div>
  );
}

export default function ProviderRequestDetailPage() {
  const { orgSlug, kind, id } = useParams();
  const navigate = useNavigate();
  useProviderOrg();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (kind === 'booking') {
        const res = await jobsAPI.getBooking(id);
        setData(res.data);
      } else if (kind === 'inquiry') {
        const res = await jobsAPI.getServiceInquiry(orgSlug, id);
        setData(res.data);
      } else {
        setError('Unknown request type.');
      }
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [kind, id, orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const title = useMemo(() => {
    if (!data) return 'Request';
    if (kind === 'booking') return data.service_name;
    return data.service_name || data.service_label || 'Custom request';
  }, [data, kind]);

  const status = data?.status;
  const statusBadgeClass = requestStatusTone(kind, status);

  const runBookingAction = async (fn, successMessage) => {
    setActionBusy(true);
    try {
      await fn();
      if (successMessage) showToast(successMessage, 'success');
      await load();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setActionBusy(false);
    }
  };

  const runInquiryAction = async (action, successMessage) => {
    setActionBusy(true);
    try {
      await jobsAPI.patchServiceInquiry(orgSlug, id, { action });
      showToast(successMessage, 'success');
      await load();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return <p className="text-center text-slate-500 py-12">Loading…</p>;
  }

  if (error || !data) {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error || 'Not found.'}</p>
    );
  }

  const mapsUrl =
    data.service_address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.service_address)}`
      : null;

  return (
    <div className="space-y-5 pb-8">
      <header className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white shadow-lg">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
          {requestStatusLabel(kind, status)}
        </span>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        {kind === 'booking' && data.start_at && (
          <p className="mt-2 text-white/90">{formatWhen(data.start_at)}</p>
        )}
        {kind === 'inquiry' && data.preferred_date && (
          <p className="mt-2 text-white/90">Preferred date: {data.preferred_date}</p>
        )}
      </header>

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Customer</h2>
        <dl className="mt-4 space-y-4">
          <DetailRow label="Name">{data.customer_name}</DetailRow>
          <DetailRow label="Email">
            <a href={`mailto:${data.customer_email}`} className="text-luminexa-accent">
              {data.customer_email}
            </a>
          </DetailRow>
          <DetailRow label="Phone">
            {data.customer_phone ? (
              <a href={`tel:${data.customer_phone}`} className="text-luminexa-accent">
                {data.customer_phone}
              </a>
            ) : (
              <span className="text-slate-500">Not provided</span>
            )}
          </DetailRow>
        </dl>
      </section>

      {kind === 'booking' && (
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Service</h2>
          <dl className="mt-4 space-y-4">
            <DetailRow label="Duration">{data.service_duration_minutes} minutes</DetailRow>
            <DetailRow label="Price">{currency.format(Number(data.service_base_price))}</DetailRow>
            <DetailRow label="Time">
              {formatTime(data.start_at)} – {formatTime(data.end_at)}
            </DetailRow>
          </dl>
        </section>
      )}

      {(data.service_address || kind === 'inquiry') && (
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            {kind === 'booking' ? 'Service address' : 'Location'}
          </h2>
          {data.service_address ? (
            <div className="mt-3">
              <p className="whitespace-pre-wrap text-slate-900">{data.service_address}</p>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-800"
                >
                  Open in Maps →
                </a>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No address provided.</p>
          )}
        </section>
      )}

      {kind === 'inquiry' && data.message && (
        <section className="rounded-xl border border-violet-100 bg-violet-50/50 p-5">
          <h2 className="text-sm font-semibold text-violet-900">Original request</h2>
          <p className="mt-2 whitespace-pre-wrap text-slate-800">{data.message}</p>
        </section>
      )}

      {kind === 'booking' && data.customer_notes && (
        <section className="rounded-xl border border-amber-100 bg-amber-50/50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Customer notes</h2>
          <p className="mt-2 text-slate-800">{data.customer_notes}</p>
        </section>
      )}

      {kind === 'booking' && data.status_events?.length > 0 && (
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Activity</h2>
          <div className="mt-4">
            <BookingStatusTimeline events={data.status_events} />
          </div>
        </section>
      )}

      <RequestMessageThread
        customerName={data.customer_name}
        loadMessages={() =>
          kind === 'booking'
            ? jobsAPI.listBookingMessages(id)
            : jobsAPI.listInquiryMessages(orgSlug, id)
        }
        sendMessage={(body) =>
          kind === 'booking'
            ? jobsAPI.sendBookingMessage(id, body)
            : jobsAPI.sendInquiryMessage(orgSlug, id, body)
        }
      />

      {kind === 'booking' && status === 'requested' && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => runBookingAction(() => jobsAPI.acceptBooking(id), 'Request approved.')}
            className="min-h-[48px] flex-1 rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={actionBusy}
            onClick={() =>
              runBookingAction(async () => {
                await jobsAPI.declineBooking(id);
                navigate(providerRequests(orgSlug));
              }, null)
            }
            className="min-h-[48px] flex-1 rounded-xl border border-slate-200 font-medium text-slate-700 disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      )}

      {kind === 'booking' && status === 'confirmed' && (
        <button
          type="button"
          disabled={actionBusy}
          onClick={() => runBookingAction(() => jobsAPI.completeBooking(id), 'Marked as done.')}
          className="min-h-[48px] w-full rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
        >
          Mark done
        </button>
      )}

      {kind === 'inquiry' && status === 'pending' && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => runInquiryAction('accept', 'Request approved.')}
            className="min-h-[48px] w-full rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => runInquiryAction('decline', 'Request declined.')}
            className="min-h-[48px] w-full rounded-xl border border-slate-200 font-medium text-slate-700 disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      )}

      {kind === 'inquiry' && status === 'active' && (
        <button
          type="button"
          disabled={actionBusy}
          onClick={() => runInquiryAction('complete', 'Marked as done.')}
          className="min-h-[48px] w-full rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
        >
          Mark done
        </button>
      )}
    </div>
  );
}
