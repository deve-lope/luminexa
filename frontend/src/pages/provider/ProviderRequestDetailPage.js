import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BookingStatusTimeline from '../../components/booking/BookingStatusTimeline';
import CompleteBookingInvoiceModal from '../../components/booking/CompleteBookingInvoiceModal';
import InvoicePanel from '../../components/booking/InvoicePanel';
import RescheduleBookingModal from '../../components/booking/RescheduleBookingModal';
import ServiceAddressBlock from '../../components/booking/ServiceAddressBlock';
import RequestMessageThread from '../../components/provider/RequestMessageThread';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { useToast } from '../../contexts/ToastContext';
import { jobsAPI } from '../../utils/api';
import { formatTime, formatWhen } from '../../utils/datetime';
import parseApiError from '../../utils/parseApiError';
import { providerRequests, providerScheduleDetail } from '../../utils/providerPaths';
import { requestStatusLabel, requestStatusTone } from '../../utils/requestStatus';
import { formatDurationLabel, formatJobLocationLabel, isShopService, moneyFormatter } from '../../utils/serviceDisplay';

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
  const { activeOrg } = useProviderOrg();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

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

  const currency = useMemo(
    () => moneyFormatter(data?.currency || data?.invoice?.currency || 'CAD'),
    [data?.currency, data?.invoice?.currency],
  );

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
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
        <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm">Loading request…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error || 'Not found.'}</p>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
            {requestStatusLabel(kind, status)}
          </span>
          {data.reference && (
            <span className="rounded bg-white/20 px-2 py-0.5 font-mono text-xs text-white/90">
              {data.reference}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        {kind === 'booking' && data.start_at && (
          <p className="mt-2 text-white/90">{formatWhen(data.start_at)}</p>
        )}
        {kind === 'inquiry' && data.preferred_date && (
          <p className="mt-2 text-white/90">Preferred date: {data.preferred_date}</p>
        )}
        {kind === 'booking' && status === 'requested' && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => runBookingAction(() => jobsAPI.acceptBooking(id), 'Request approved.')}
              className="min-h-[44px] rounded-xl bg-white font-semibold text-violet-700 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={actionBusy || new Date(data.start_at) <= new Date()}
              onClick={() => setRescheduleOpen(true)}
              className="min-h-[44px] rounded-xl bg-white/90 font-semibold text-violet-700 disabled:opacity-60"
            >
              Reschedule
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
              className="min-h-[44px] rounded-xl bg-white/20 font-semibold text-white disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        )}
        {kind === 'booking' && status === 'confirmed' && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => setRescheduleOpen(true)}
              className="min-h-[44px] flex-1 rounded-xl bg-white font-semibold text-violet-700 disabled:opacity-60"
            >
              Reschedule
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => setCompleteOpen(true)}
              className="min-h-[44px] flex-1 rounded-xl bg-white/20 font-semibold text-white disabled:opacity-60"
            >
              Mark complete
            </button>
          </div>
        )}
        {kind === 'booking' && status === 'in_progress' && (
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => setCompleteOpen(true)}
            className="mt-4 min-h-[44px] w-full rounded-xl bg-white font-semibold text-violet-700 disabled:opacity-60"
          >
            Mark complete
          </button>
        )}
        {kind === 'inquiry' && status === 'pending' && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => runInquiryAction('accept', 'Request approved.')}
              className="min-h-[44px] flex-1 rounded-xl bg-white font-semibold text-violet-700 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => runInquiryAction('decline', 'Request declined.')}
              className="min-h-[44px] flex-1 rounded-xl bg-white/20 font-semibold text-white disabled:opacity-60"
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
            className="mt-4 min-h-[44px] w-full rounded-xl bg-white font-semibold text-violet-700 disabled:opacity-60"
          >
            Mark done
          </button>
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
            <DetailRow label="Duration">{formatDurationLabel(data.service_duration_minutes) || '—'}</DetailRow>
            <DetailRow label="Price">{currency.format(Number(data.service_base_price))}</DetailRow>
            <DetailRow label="Time">
              {formatTime(data.start_at)} – {formatTime(data.end_at)}
            </DetailRow>
          </dl>
        </section>
      )}

      {(kind === 'booking' || data.service_address || kind === 'inquiry') && (
        <ServiceAddressBlock
          address={data.job_location || data.service_address}
          title={
            kind === 'booking'
              ? formatJobLocationLabel(data)
              : 'Job location'
          }
          subtitle={
            kind === 'booking'
              ? isShopService(data)
                ? 'Customer comes to your shop for this service.'
                : 'You go to the customer for this service.'
              : ''
          }
          emptyLabel="No address provided."
        />
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

      {kind === 'booking' && data.invoice && (
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Invoice</h2>
          <div className="mt-3">
            <InvoicePanel
              invoice={data.invoice}
              bookingId={data.id}
              providerName={
                data.invoice.provider_name ||
                data.organization_name ||
                activeOrg?.organization_name
              }
            />
          </div>
        </section>
      )}

      {kind === 'booking' && status === 'completed' && !data.invoice && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Invoice</h2>
          <p className="mt-2 text-sm text-amber-800">
            This job is complete but no invoice is on file yet.
          </p>
          <button
            type="button"
            onClick={() => navigate(providerScheduleDetail(orgSlug, 'booking', data.id))}
            className="mt-3 min-h-[44px] w-full rounded-xl bg-white text-sm font-semibold text-amber-900 ring-1 ring-amber-200"
          >
            Open booking to issue invoice
          </button>
        </section>
      )}

      {kind === 'booking' && (status === 'confirmed' || status === 'completed') && (
        <a
          href={jobsAPI.bookingIcalUrl(id)}
          download
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <svg className="h-4 w-4 text-luminexa-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Add to calendar
        </a>
      )}

      {kind === 'booking' &&
        (status === 'confirmed' || status === 'in_progress' || status === 'completed' || status === 'needs_return') && (
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Schedule</h2>
          <p className="mt-2 text-sm text-slate-600">
            Open the full booking page for start/complete, invoice, and return-visit actions.
          </p>
          <button
            type="button"
            onClick={() => navigate(providerScheduleDetail(orgSlug, 'booking', data.id))}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-slate-200 font-medium text-slate-700"
          >
            Open full booking
          </button>
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

      {kind === 'booking' && (
        <RescheduleBookingModal
          open={rescheduleOpen}
          audience="provider"
          booking={{
            ...data,
            organization_slug: data.organization_slug || orgSlug,
          }}
          onClose={() => setRescheduleOpen(false)}
          onRescheduled={() => {
            showToast('Booking rescheduled.', 'success');
            setRescheduleOpen(false);
            load();
          }}
        />
      )}

      {kind === 'booking' && (
        <CompleteBookingInvoiceModal
          open={completeOpen}
          booking={data}
          busy={actionBusy}
          onClose={() => setCompleteOpen(false)}
          onConfirm={async (payload) => {
            setActionBusy(true);
            try {
              await jobsAPI.completeBooking(id, payload);
              showToast('Booking completed and invoice issued.', 'success');
              setCompleteOpen(false);
              await load();
            } catch (e) {
              setError(parseApiError(e));
            } finally {
              setActionBusy(false);
            }
          }}
        />
      )}

    </div>
  );
}
