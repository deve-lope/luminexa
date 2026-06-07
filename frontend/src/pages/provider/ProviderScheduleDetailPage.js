import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { formatTime, formatWhen } from '../../utils/datetime';
import RescheduleBookingModal from '../../components/booking/RescheduleBookingModal';
import BookingStatusTimeline from '../../components/booking/BookingStatusTimeline';
import { getProviderBookingDetailUrl } from '../../utils/bookingLink';
import { providerSchedule, providerScheduleDetail } from '../../utils/providerPaths';
import parseApiError from '../../utils/parseApiError';
import { useToast } from '../../contexts/ToastContext';

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

export default function ProviderScheduleDetailPage() {
  const { orgSlug, kind, id } = useParams();
  const navigate = useNavigate();
  useProviderOrg();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (kind === 'booking') {
        res = await jobsAPI.getBooking(id);
      } else if (kind === 'slot') {
        res = await jobsAPI.getSlot(id);
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
  }, [kind, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-center text-slate-500 py-12">Loading…</p>;
  }

  if (error || !data) {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error || 'Not found.'}</p>
    );
  }

  if (kind === 'booking') {
    const mapsUrl = data.service_address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.service_address)}`
      : null;
    return (
      <div className="space-y-5 pb-8">
        <header className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white shadow-lg">
          <p className="text-sm text-violet-200 capitalize">{data.status?.replace('_', ' ')}</p>
          <h1 className="mt-1 text-2xl font-bold">{data.service_name}</h1>
          <p className="mt-2 text-white/90">{formatWhen(data.start_at)}</p>
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

        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Service</h2>
          <dl className="mt-4 space-y-4">
            <DetailRow label="Service">{data.service_name}</DetailRow>
            <DetailRow label="Duration">{data.service_duration_minutes} minutes</DetailRow>
            <DetailRow label="Price">{currency.format(Number(data.service_base_price))}</DetailRow>
            <DetailRow label="Time">
              {formatTime(data.start_at)} – {formatTime(data.end_at)}
            </DetailRow>
          </dl>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Service address</h2>
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
            <p className="mt-3 text-sm text-slate-500">No address on file for this booking.</p>
          )}
        </section>

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

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Share</h2>
          <p className="mt-1 text-sm text-slate-600">Copy a direct link to this booking.</p>
          <button
            type="button"
            onClick={async () => {
              const url = getProviderBookingDetailUrl(orgSlug, data.id);
              try {
                await navigator.clipboard.writeText(url);
              } catch {
                const input = document.createElement('textarea');
                input.value = url;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
              }
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-3 w-full min-h-[44px] rounded-xl border border-slate-200 font-medium text-slate-800"
          >
            {copied ? 'Link copied' : 'Copy booking link'}
          </button>
        </section>

        {data.status === 'requested' && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={async () => {
                setActionBusy(true);
                try {
                  await jobsAPI.acceptBooking(data.id);
                  load();
                } finally {
                  setActionBusy(false);
                }
              }}
              className="min-h-[48px] flex-1 rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
            >
              Accept request
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
              className="min-h-[48px] flex-1 rounded-xl border border-slate-200 font-medium text-slate-700 disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        )}

        {(data.status === 'confirmed' || data.status === 'requested') &&
          new Date(data.start_at) > new Date() && (
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => setRescheduleOpen(true)}
            className="min-h-[48px] w-full rounded-xl border border-violet-200 font-medium text-violet-800 disabled:opacity-60"
          >
            Reschedule
          </button>
        )}

        {data.status === 'confirmed' && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={async () => {
                setActionBusy(true);
                try {
                  await jobsAPI.completeBooking(data.id);
                  showToast('Booking marked complete.', 'success');
                  load();
                } catch (e) {
                  setError(parseApiError(e));
                } finally {
                  setActionBusy(false);
                }
              }}
              className="min-h-[48px] w-full rounded-xl bg-luminexa-accent font-medium text-white disabled:opacity-60"
            >
              Mark complete
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={async () => {
                if (!window.confirm('Mark customer as no-show?')) return;
                setActionBusy(true);
                try {
                  await jobsAPI.markBookingNoShow(data.id);
                  showToast('Marked as no-show.', 'success');
                  load();
                } catch (e) {
                  setError(parseApiError(e));
                } finally {
                  setActionBusy(false);
                }
              }}
              className="min-h-[48px] w-full rounded-xl border border-amber-200 font-medium text-amber-800 disabled:opacity-60"
            >
              Mark no-show
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={async () => {
                if (!window.confirm('Cancel this booking?')) return;
                setActionBusy(true);
                try {
                  await jobsAPI.cancelBooking(data.id);
                  navigate(providerSchedule(orgSlug));
                } catch (e) {
                  setError(parseApiError(e));
                } finally {
                  setActionBusy(false);
                }
              }}
              className="min-h-[48px] w-full rounded-xl border border-red-200 font-medium text-red-700 disabled:opacity-60"
            >
              Cancel booking
            </button>
          </div>
        )}

        <RescheduleBookingModal
          open={rescheduleOpen}
          booking={{
            ...data,
            organization_slug: data.organization_slug || orgSlug,
          }}
          onClose={() => setRescheduleOpen(false)}
          onRescheduled={() => {
            showToast('Booking rescheduled.', 'success');
            load();
          }}
        />
      </div>
    );
  }

  if (kind === 'slot') {
    const hasBooking = data.booking_id;
    return (
      <div className="space-y-5 pb-8">
        <header className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg">
          <p className="text-sm text-emerald-100 capitalize">{data.status}</p>
          <h1 className="mt-1 text-2xl font-bold">{data.service_name}</h1>
          <p className="mt-2 text-white/90">{formatWhen(data.start_at)}</p>
        </header>

        {hasBooking ? (
          <>
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-600">This slot has a booking attached.</p>
              <button
                type="button"
                onClick={() =>
                  navigate(providerScheduleDetail(orgSlug, 'booking', data.booking_id))
                }
                className="mt-4 w-full min-h-[48px] rounded-xl bg-luminexa-accent font-medium text-white"
              >
                View full booking details
              </button>
            </section>
            {data.customer_name && (
              <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <h2 className="text-sm font-semibold uppercase text-slate-500">Quick info</h2>
                <p className="mt-2 font-medium text-slate-900">{data.customer_name}</p>
                {data.service_address && (
                  <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{data.service_address}</p>
                )}
              </section>
            )}
          </>
        ) : (
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-slate-600">Open slot — no customer booked yet.</p>
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
