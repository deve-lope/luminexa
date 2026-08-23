import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { formatTime, formatWhen } from '../../utils/datetime';
import RescheduleBookingModal from '../../components/booking/RescheduleBookingModal';
import IncompleteReturnVisitModal from '../../components/booking/IncompleteReturnVisitModal';
import CompleteBookingInvoiceModal from '../../components/booking/CompleteBookingInvoiceModal';
import InvoicePanel from '../../components/booking/InvoicePanel';
import JobCostPanel from '../../components/booking/JobCostPanel';
import ServiceAddressBlock from '../../components/booking/ServiceAddressBlock';
import ConfirmDialog from '../../components/ConfirmDialog';
import Skeleton from '../../components/Skeleton';
import BookingStatusTimeline from '../../components/booking/BookingStatusTimeline';
import { getCustomerAppointmentUrl } from '../../utils/bookingLink';
import LinkShareBar from '../../components/LinkShareBar';
import { providerSchedule, providerScheduleDetail, providerRequestDetail } from '../../utils/providerPaths';
import {
  dismissProviderNotificationsForBooking,
  emitProviderNotificationsChanged,
} from '../../utils/providerNotifications';
import { formatDurationLabel, formatJobLocationLabel, isShopService, moneyFormatter, serviceRequiresQuote } from '../../utils/serviceDisplay';
import { formatLocalDateKey } from '../../utils/dateRange';
import parseApiError from '../../utils/parseApiError';
import { useToast } from '../../contexts/ToastContext';
import { bookingStatusLabel } from '../../utils/customerBookings';
import { canStartOrCompleteJob, jobActionAvailableAt } from '../../utils/jobActions';

function DetailRow({ label, children }) {
  if (!children) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{children}</dd>
    </div>
  );
}

export default function ProviderScheduleDetailPage() {
  const { orgSlug, kind, id } = useParams();
  const navigate = useNavigate();
  useProviderOrg();
  const [data, setData] = useState(null);
  const [siblingSlots, setSiblingSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [returnVisitOpen, setReturnVisitOpen] = useState(false);
  const [returnVisitMode, setReturnVisitMode] = useState('full');
  const [completeOpen, setCompleteOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const { showToast } = useToast();

  const runNoShow = async () => {
    setActionBusy(true);
    try {
      await jobsAPI.markBookingNoShow(id);
      showToast('Marked as no-show.', 'success');
      setConfirmAction(null);
      load();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setActionBusy(false);
    }
  };

  const runCancel = async () => {
    setActionBusy(true);
    try {
      await jobsAPI.cancelBooking(id);
      navigate(providerSchedule(orgSlug));
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setActionBusy(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (kind === 'booking') {
        res = await jobsAPI.getBooking(id);
        // Backend dismisses booking-update alerts on retrieve; refresh bell/home/tab.
        emitProviderNotificationsChanged();
      } else if (kind === 'slot') {
        res = await jobsAPI.getSlot(id);
        setData(res.data);
        // Same clock time often has one open slot per service — show them all.
        if (res.data?.start_at && orgSlug) {
          try {
            const dayKey = formatLocalDateKey(new Date(res.data.start_at));
            const listRes = await jobsAPI.listSlots({
              organization: orgSlug,
              from: dayKey,
              until: dayKey,
            });
            const all = listRes.data?.slots ?? (Array.isArray(listRes.data) ? listRes.data : []);
            const startMs = new Date(res.data.start_at).getTime();
            setSiblingSlots(
              (Array.isArray(all) ? all : []).filter(
                (s) =>
                  s.status === 'open' &&
                  new Date(s.start_at).getTime() === startMs
              )
            );
          } catch {
            setSiblingSlots([]);
          }
        } else {
          setSiblingSlots([]);
        }
        return;
      } else if (kind === 'block') {
        res = await jobsAPI.getUnavailableBlock(id);
      } else {
        setError('Unknown detail type.');
        return;
      }
      setData(res.data);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [kind, id, orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (kind !== 'booking' || !id || !orgSlug) return undefined;
    let cancelled = false;
    dismissProviderNotificationsForBooking(orgSlug, id).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [kind, id, orgSlug]);

  const currency = useMemo(
    () => moneyFormatter(data?.currency || data?.invoice?.currency || 'CAD'),
    [data?.currency, data?.invoice?.currency],
  );

  if (loading) {
    return (
      <div className="space-y-5 pb-8" aria-busy="true" aria-label="Loading booking">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error || 'Not found.'}</p>
    );
  }

  const canJobAction = canStartOrCompleteJob(data);
  const jobActionFrom = jobActionAvailableAt(data);

  if (kind === 'booking') {
    return (
      <div className="space-y-5 pb-8">
        <header className="rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 p-5 text-white shadow-lg">
          <p className="text-sm text-violet-200">
            {bookingStatusLabel(data.status)}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{data.service_name}</h1>
          <p className="mt-2 text-white/90">{formatWhen(data.start_at)}</p>
          {data.parent_booking_id && (
            <button
              type="button"
              onClick={() =>
                navigate(providerScheduleDetail(orgSlug, 'booking', data.parent_booking_id))
              }
              className="mt-3 text-sm font-medium text-violet-100 underline"
            >
              View original job →
            </button>
          )}
        </header>

        {(data.status === 'needs_return' || data.return_visit_id) && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">Return visit</h2>
            {data.return_visit_id ? (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-amber-900">
                  Scheduled{' '}
                  {data.return_visit_start_at
                    ? formatWhen(data.return_visit_start_at)
                    : ''}{' '}
                  · {bookingStatusLabel(data.return_visit_status)}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    navigate(providerScheduleDetail(orgSlug, 'booking', data.return_visit_id))
                  }
                  className="min-h-[40px] rounded-lg bg-white px-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200"
                >
                  Open return visit
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-amber-900">
                Job marked incomplete. Schedule a return visit when ready.
              </p>
            )}
          </section>
        )}

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

        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Service</h2>
          <dl className="mt-4 space-y-4">
            <DetailRow label="Service">{data.service_name}</DetailRow>
            <DetailRow label="Duration">{formatDurationLabel(data.service_duration_minutes) || '—'}</DetailRow>
            <DetailRow label="Price">{currency.format(Number(data.service_base_price))}</DetailRow>
            <DetailRow label="Time">
              {formatTime(data.start_at)} – {formatTime(data.end_at)}
            </DetailRow>
          </dl>
          {data.invoice && (
            <div className="mt-4">
              <InvoicePanel
                invoice={data.invoice}
                bookingId={data.id}
                providerName={data.invoice.provider_name || data.organization_name}
              />
            </div>
          )}
          {kind === 'booking' && (
            <div className="mt-4">
              <JobCostPanel
                bookingId={data.id}
                currency={data.currency || data.invoice?.currency || 'CAD'}
                initialLines={data.cost_lines || []}
                initialProfit={data.profit}
                onChanged={(payload) => {
                  if (payload?.profit) {
                    setData((prev) =>
                      prev
                        ? {
                            ...prev,
                            profit: payload.profit,
                            cost_lines: payload.cost_lines || prev.cost_lines,
                          }
                        : prev
                    );
                  }
                }}
              />
            </div>
          )}
          {data.status === 'completed' && !data.invoice && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => setCompleteOpen(true)}
              className="mt-4 min-h-[44px] w-full rounded-xl border border-violet-200 text-sm font-medium text-violet-800 disabled:opacity-60"
            >
              Issue invoice
            </button>
          )}
        </section>

        <ServiceAddressBlock
          address={data.job_location || data.service_address}
          title={formatJobLocationLabel(data)}
          subtitle={
            isShopService(data)
              ? 'Customer comes to your shop for this service.'
              : 'You go to the customer for this service.'
          }
          emptyLabel="No address on file for this booking."
        />

        {data.customer_notes && (
          <section className="rounded-xl border border-amber-100 bg-amber-50/50 p-5">
            <h2 className="text-sm font-semibold text-amber-900">Customer notes</h2>
            <p className="mt-2 text-slate-800">{data.customer_notes}</p>
          </section>
        )}

        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Activity</h2>
          <div className="mt-4">
            <BookingStatusTimeline events={data.status_events} />
          </div>
        </section>

        <section className="lx-card">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Share with customer</h2>
          <p className="mt-1 text-sm text-slate-600">
            Send this link so they can view the appointment in the browser or the Luminexa app.
          </p>
          <div className="mt-3">
            <LinkShareBar
              url={data.customer_view_url || getCustomerAppointmentUrl(data.customer_view_token)}
              title={data.organization_name || 'Your Luminexa booking'}
              text={`${data.service_name || 'Your appointment'} with ${data.organization_name || 'your provider'}`}
              showInput={false}
              copyLabel="Copy link"
              compact
            />
          </div>
        </section>

        {data.status === 'requested' &&
          !(data.requires_quote || data.booking_policy === 'quote' || serviceRequiresQuote(data.service_pricing_type)) && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={actionBusy}
              onClick={async () => {
                setActionBusy(true);
                try {
                  await jobsAPI.acceptBooking(data.id);
                  showToast('Request approved.', 'success');
                  load();
                } catch (e) {
                  setError(parseApiError(e));
                } finally {
                  setActionBusy(false);
                }
              }}
              className="lx-btn-primary min-h-[48px] disabled:opacity-60"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={actionBusy || new Date(data.start_at) <= new Date()}
              onClick={() => setRescheduleOpen(true)}
              className="min-h-[48px] rounded-xl border border-violet-200 font-medium text-violet-800 disabled:opacity-60"
            >
              Reschedule
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={async () => {
                setActionBusy(true);
                try {
                  await jobsAPI.declineBooking(data.id);
                  navigate(providerSchedule(orgSlug));
                } finally {
                  setActionBusy(false);
                }
              }}
              className="min-h-[48px] rounded-xl border border-slate-200 font-medium text-slate-700 disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        )}

        {(data.status === 'requested' || data.status === 'quoted') &&
          (data.requires_quote || data.booking_policy === 'quote' || serviceRequiresQuote(data.service_pricing_type)) && (
          <Link
            to={providerRequestDetail(orgSlug, kind || 'booking', data.id)}
            className="lx-btn-primary flex min-h-[48px] items-center justify-center"
          >
            {data.status === 'quoted' ? 'Update quote' : 'Send quote'}
          </Link>
        )}

        {data.status === 'confirmed' && new Date(data.start_at) > new Date() && (
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => setRescheduleOpen(true)}
            className="min-h-[48px] w-full rounded-xl border border-violet-200 font-medium text-violet-800 disabled:opacity-60"
          >
            Reschedule
          </button>
        )}

        {(data.status === 'confirmed' || data.status === 'in_progress') && (
          <div className="flex flex-col gap-2">
            {!canJobAction && jobActionFrom && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Start job and mark complete are available from {formatWhen(jobActionFrom.toISOString())}{' '}
                (6 hours before the appointment).
              </p>
            )}
            {data.status === 'confirmed' && canJobAction && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={async () => {
                  setActionBusy(true);
                  try {
                    await jobsAPI.startBooking(data.id);
                    showToast('Job started.', 'success');
                    load();
                  } catch (e) {
                    setError(parseApiError(e));
                  } finally {
                    setActionBusy(false);
                  }
                }}
                className="min-h-[48px] w-full rounded-xl bg-emerald-600 font-medium text-white disabled:opacity-60"
              >
                Start job
              </button>
            )}
            {canJobAction && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setCompleteOpen(true)}
                className="min-h-[48px] w-full rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
              >
                Mark complete
              </button>
            )}
            {data.status === 'in_progress' && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => {
                  setReturnVisitMode('full');
                  setReturnVisitOpen(true);
                }}
                className="min-h-[48px] w-full rounded-xl border border-amber-300 bg-amber-50 font-medium text-amber-900 disabled:opacity-60"
              >
                Incomplete — return visit
              </button>
            )}
            {data.status === 'confirmed' && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setConfirmAction('noshow')}
                className="min-h-[48px] w-full rounded-xl border border-amber-200 font-medium text-amber-800 disabled:opacity-60"
              >
                Mark no-show
              </button>
            )}
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => setConfirmAction('cancel')}
              className="min-h-[48px] w-full rounded-xl border border-red-200 font-medium text-red-700 disabled:opacity-60"
            >
              Cancel booking
            </button>
          </div>
        )}

        {data.status === 'needs_return' && !data.return_visit_id && (
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => {
              setReturnVisitMode('schedule');
              setReturnVisitOpen(true);
            }}
            className="min-h-[48px] w-full rounded-xl bg-violet-600 font-medium text-white disabled:opacity-60"
          >
            Schedule return visit
          </button>
        )}

        <RescheduleBookingModal
          open={rescheduleOpen}
          audience="provider"
          booking={{
            ...data,
            organization_slug: data.organization_slug || orgSlug,
          }}
          onClose={() => setRescheduleOpen(false)}
          onRescheduled={() => {
            showToast('New time sent — waiting for the customer to accept.', 'success');
            setRescheduleOpen(false);
            load();
          }}
        />

        <IncompleteReturnVisitModal
          open={returnVisitOpen}
          mode={returnVisitMode}
          booking={{
            ...data,
            organization_slug: data.organization_slug || orgSlug,
          }}
          onClose={() => setReturnVisitOpen(false)}
          onDone={(payload) => {
            const returnId = payload?.return_booking?.id;
            showToast(
              returnId
                ? 'Return visit scheduled and customer notified.'
                : 'Marked incomplete — schedule the return visit when ready.',
              'success'
            );
            setReturnVisitOpen(false);
            if (returnId) {
              navigate(providerScheduleDetail(orgSlug, 'booking', returnId));
            } else {
              load();
            }
          }}
        />

        <CompleteBookingInvoiceModal
          open={completeOpen}
          booking={data}
          busy={actionBusy}
          onClose={() => setCompleteOpen(false)}
          onConfirm={async (payload) => {
            setActionBusy(true);
            try {
              if (data.status === 'completed' && !data.invoice) {
                await jobsAPI.issueBookingInvoice(data.id, payload);
                showToast('Invoice issued.', 'success');
              } else {
                await jobsAPI.completeBooking(data.id, payload);
                showToast('Booking completed and invoice issued.', 'success');
              }
              setCompleteOpen(false);
              load();
            } catch (e) {
              setError(parseApiError(e));
            } finally {
              setActionBusy(false);
            }
          }}
        />

        <ConfirmDialog
          open={confirmAction === 'noshow'}
          title="Mark customer as no-show?"
          message="This cancels the booking and frees the slot. Use this when the customer didn't show up."
          confirmLabel="Mark no-show"
          cancelLabel="Back"
          tone="default"
          busy={actionBusy}
          onConfirm={runNoShow}
          onClose={() => setConfirmAction(null)}
        />
        <ConfirmDialog
          open={confirmAction === 'cancel'}
          title="Cancel this booking?"
          message="This frees up the slot and notifies the customer. This can't be undone."
          confirmLabel="Cancel booking"
          cancelLabel="Keep booking"
          busy={actionBusy}
          onConfirm={runCancel}
          onClose={() => setConfirmAction(null)}
        />
      </div>
    );
  }

  if (kind === 'slot') {
    const hasBooking = data.booking_id;
    const capacity = Number(data.capacity) || 1;
    const occupied = Number(data.occupied_count) || 0;
    const remaining = Number(data.remaining_capacity);
    const spotsLeft = Number.isFinite(remaining) ? remaining : Math.max(0, capacity - occupied);
    const openPeers = siblingSlots.length
      ? siblingSlots
      : data.status === 'open'
        ? [data]
        : [];
    return (
      <div className="space-y-5 pb-8">
        <header className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg">
          <p className="text-sm text-emerald-100 capitalize">{data.status}</p>
          <h1 className="mt-1 text-2xl font-bold">
            {hasBooking ? data.service_name : 'Open time'}
          </h1>
          <p className="mt-2 text-white/90">{formatWhen(data.start_at)}</p>
          {capacity > 1 && (
            <p className="mt-2 text-sm text-emerald-50">
              {occupied} of {capacity} spots filled
              {spotsLeft > 0 ? ` · ${spotsLeft} still open` : ' · full'}
            </p>
          )}
        </header>

        {hasBooking ? (
          <>
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-600">
                {capacity > 1
                  ? 'This time has one or more bookings. Open the latest booking for details.'
                  : 'This slot has a booking attached.'}
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate(providerScheduleDetail(orgSlug, 'booking', data.booking_id))
                }
                className="mt-4 w-full min-h-[48px] rounded-xl bg-luminexa-accent font-medium text-white"
              >
                View booking details
              </button>
            </section>
            {data.customer_name && (
              <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <h2 className="text-sm font-semibold uppercase text-slate-500">Quick info</h2>
                <p className="mt-2 font-medium text-slate-900">{data.customer_name}</p>
                {data.service_address && (
                  <div className="mt-2">
                    <p className="text-xs font-medium uppercase text-slate-500">Job location</p>
                    <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{data.service_address}</p>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-slate-600">
              Customers can book any of these services at this time. Each service has its own open
              slot under the hood.
            </p>
            <ul className="mt-4 space-y-2">
              {openPeers.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    String(s.id) === String(data.id)
                      ? 'border-emerald-300 bg-emerald-50 font-medium text-emerald-950'
                      : 'border-slate-200 text-slate-800'
                  }`}
                >
                  {s.service_name || data.service_name || 'Service'}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  if (kind === 'block') {
    return (
      <div className="space-y-5 pb-8">
        <header className="rounded-2xl bg-slate-600 p-5 text-white shadow-lg">
          <p className="text-sm text-slate-300">Unavailable</p>
          <h1 className="mt-1 text-2xl font-bold">Blocked time</h1>
          <p className="mt-2 text-white/90">{formatWhen(data.start_at)}</p>
        </header>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <dl className="space-y-4">
            <DetailRow label="From">{formatWhen(data.start_at)}</DetailRow>
            <DetailRow label="To">{formatWhen(data.end_at)}</DetailRow>
            <DetailRow label="Note">{data.note || '—'}</DetailRow>
          </dl>
        </section>
      </div>
    );
  }

  return null;
}
