import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BookingStatusTimeline from '../../components/booking/BookingStatusTimeline';
import AddToCalendarModal from '../../components/booking/AddToCalendarModal';
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
import {
  dismissProviderNotificationsForBooking,
  emitProviderNotificationsChanged,
} from '../../utils/providerNotifications';
import { requestStatusLabel, requestStatusTone } from '../../utils/requestStatus';
import { canStartOrCompleteJob, jobActionAvailableAt } from '../../utils/jobActions';
import { formatDurationLabel, formatJobLocationLabel, isShopService, moneyFormatter, serviceRequiresQuote } from '../../utils/serviceDisplay';

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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [quoteQuestions, setQuoteQuestions] = useState(['']);
  const [quoteFormMode, setQuoteFormMode] = useState(null); // 'ask' | 'quote' | null

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (kind === 'booking') {
        const res = await jobsAPI.getBooking(id);
        setData(res.data);
        // Backend dismisses booking-update alerts on retrieve; refresh bell/home/tab.
        emitProviderNotificationsChanged();
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
  const canJobAction = kind === 'booking' && canStartOrCompleteJob(data);
  const jobActionFrom = kind === 'booking' ? jobActionAvailableAt(data) : null;
  const statusBadgeClass = requestStatusTone(kind, status);
  const isQuotePolicy = data?.booking_policy === 'quote';
  const needsQuote =
    kind === 'booking' &&
    (data?.requires_quote ||
      isQuotePolicy ||
      serviceRequiresQuote(data?.service_pricing_type)) &&
    (status === 'requested' || status === 'quoted');

  useEffect(() => {
    if (!data || kind !== 'booking') return;
    const existing = data.quote_questions || [];
    if (existing.length) {
      setQuoteQuestions(existing.map((q) => q.question || ''));
      if (data.quote_amount != null) setQuoteAmount(String(data.quote_amount));
      if (data.quote_message) setQuoteMessage(data.quote_message);
    }
  }, [data, kind]);

  const sendQuote = async () => {
    const amount = Number(quoteAmount);
    if (!(amount > 0)) {
      setError('Enter a quote amount greater than zero.');
      return;
    }
    const payload = {
      amount,
      message: quoteMessage.trim(),
    };
    await runBookingAction(
      () => jobsAPI.sendBookingQuote(id, payload),
      'Quote sent to customer.'
    );
    setQuoteFormMode(null);
  };

  const askQuestions = async () => {
    const questions = quoteQuestions.map((q) => q.trim()).filter(Boolean);
    if (!questions.length) {
      setError('Add at least one question for the customer.');
      return;
    }
    await runBookingAction(
      () =>
        jobsAPI.askBookingQuoteQuestions(id, {
          questions,
          message: quoteMessage.trim(),
        }),
      'Questions sent — customer will be notified.'
    );
    setQuoteFormMode(null);
  };

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
        {kind === 'booking' && data.awaiting_customer_acceptance && (
          <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-sm text-white/95">
            Waiting for the customer to accept the new time
            {data.prior_start_at ? ` (was ${formatWhen(data.prior_start_at)})` : ''}.
            {needsQuote && status !== 'quoted'
              ? data?.awaiting_quote_details
                ? ' Waiting for the customer to answer your questions.'
                : ' Ask questions if you need details, then send a quote.'
              : ''}
          </p>
        )}
        {kind === 'booking' && data.awaiting_quote_details && (
          <p className="mt-3 rounded-xl bg-amber-400/20 px-3 py-2 text-sm text-white">
            Waiting for answers — you can send a priced quote after the customer replies.
          </p>
        )}
        {kind === 'booking' &&
          status === 'requested' &&
          needsQuote &&
          !data.awaiting_quote_details &&
          (data.quote_questions || []).length > 0 &&
          (data.quote_questions || []).every((q) => (q.answer || '').trim()) && (
          <p className="mt-3 rounded-xl bg-emerald-400/20 px-3 py-2 text-sm text-white">
            Answers received — send a quote when ready.
          </p>
        )}
        {kind === 'booking' && status === 'requested' && !needsQuote && !data.awaiting_customer_acceptance && (
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
        {kind === 'booking' && status === 'requested' && !needsQuote && data.awaiting_customer_acceptance && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={actionBusy || new Date(data.start_at) <= new Date()}
              onClick={() => setRescheduleOpen(true)}
              className="min-h-[44px] rounded-xl bg-white/90 font-semibold text-violet-700 disabled:opacity-60"
            >
              Change time again
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
              Cancel request
            </button>
          </div>
        )}
        {kind === 'booking' && needsQuote && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {status === 'requested' && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() =>
                  setQuoteFormMode((m) => (m === 'ask' ? null : 'ask'))
                }
                className="min-h-[44px] rounded-xl bg-white/90 font-semibold text-violet-700 disabled:opacity-60"
              >
                {quoteFormMode === 'ask' ? 'Hide questions' : 'Ask questions'}
              </button>
            )}
            <button
              type="button"
              disabled={actionBusy || Boolean(data.awaiting_quote_details)}
              onClick={() =>
                setQuoteFormMode((m) => (m === 'quote' ? null : 'quote'))
              }
              className="min-h-[44px] rounded-xl bg-white font-semibold text-violet-700 disabled:opacity-60"
              title={
                data.awaiting_quote_details
                  ? 'Wait for the customer to answer your questions first'
                  : undefined
              }
            >
              {quoteFormMode === 'quote'
                ? 'Hide quote form'
                : status === 'quoted'
                  ? 'Update quote'
                  : 'Send quote'}
            </button>
            <button
              type="button"
              disabled={actionBusy || new Date(data.start_at) <= new Date()}
              onClick={() => setRescheduleOpen(true)}
              className="min-h-[44px] rounded-xl bg-white/90 font-semibold text-violet-700 disabled:opacity-60"
            >
              Change time
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
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setRescheduleOpen(true)}
                className="min-h-[44px] flex-1 rounded-xl bg-white font-semibold text-violet-700 disabled:opacity-60"
              >
                Reschedule
              </button>
              {canJobAction && (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => setCompleteOpen(true)}
                  className="min-h-[44px] flex-1 rounded-xl bg-white/20 font-semibold text-white disabled:opacity-60"
                >
                  Mark complete
                </button>
              )}
            </div>
            {!canJobAction && jobActionFrom && (
              <p className="text-sm text-white/85">
                Mark complete is available from {formatWhen(jobActionFrom.toISOString())} (6 hours
                before the appointment).
              </p>
            )}
          </div>
        )}
        {kind === 'booking' && status === 'in_progress' && canJobAction && (
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => setCompleteOpen(true)}
            className="mt-4 min-h-[44px] w-full rounded-xl bg-white font-semibold text-violet-700 disabled:opacity-60"
          >
            Mark complete
          </button>
        )}
        {kind === 'booking' && status === 'in_progress' && !canJobAction && jobActionFrom && (
          <p className="mt-4 text-sm text-white/85">
            Mark complete is available from {formatWhen(jobActionFrom.toISOString())} (6 hours before
            the appointment).
          </p>
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

      {kind === 'booking' && quoteFormMode === 'ask' && needsQuote && (
        <section className="rounded-xl border border-amber-100 bg-amber-50/60 p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-amber-900">Ask questions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Not a quote yet — the customer will answer these so you can price accurately. They get a
            notification to reply.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="ask-message" className="mb-1 block text-xs font-medium text-slate-600">
                Note (optional)
              </label>
              <textarea
                id="ask-message"
                rows={2}
                value={quoteMessage}
                onChange={(e) => setQuoteMessage(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="A few details help us quote accurately…"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Questions</p>
              <div className="space-y-2">
                {quoteQuestions.map((q, idx) => (
                  <input
                    key={`ask-q-${idx}`}
                    value={q}
                    onChange={(e) => {
                      const next = [...quoteQuestions];
                      next[idx] = e.target.value;
                      setQuoteQuestions(next);
                    }}
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm"
                    placeholder={`Question ${idx + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setQuoteQuestions((list) => [...list, ''])}
                className="mt-2 text-xs font-semibold text-amber-900"
              >
                + Add question
              </button>
            </div>
            <button
              type="button"
              disabled={actionBusy}
              onClick={askQuestions}
              className="min-h-[44px] w-full rounded-xl bg-amber-700 font-semibold text-white disabled:opacity-60"
            >
              {actionBusy ? 'Sending…' : 'Send questions to customer'}
            </button>
          </div>
        </section>
      )}

      {kind === 'booking' && quoteFormMode === 'quote' && needsQuote && (
        <section className="rounded-xl border border-violet-100 bg-violet-50/50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-violet-800">Send quote</h2>
          <p className="mt-1 text-sm text-slate-600">
            Set the price after you have enough detail. Use Ask questions first if you still need
            answers. Use Change time if you need a different slot.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="quote-amount" className="mb-1 block text-xs font-medium text-slate-600">
                Quote amount
              </label>
              <input
                id="quote-amount"
                type="number"
                min="0"
                step="0.01"
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm"
                placeholder="e.g. 120.00"
              />
            </div>
            <div>
              <label htmlFor="quote-message" className="mb-1 block text-xs font-medium text-slate-600">
                What’s included
              </label>
              <textarea
                id="quote-message"
                rows={3}
                value={quoteMessage}
                onChange={(e) => setQuoteMessage(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Scope, materials, notes…"
              />
            </div>
            <button
              type="button"
              disabled={actionBusy}
              onClick={sendQuote}
              className="min-h-[44px] w-full rounded-xl bg-violet-700 font-semibold text-white disabled:opacity-60"
            >
              {actionBusy ? 'Sending…' : 'Send quote to customer'}
            </button>
          </div>
        </section>
      )}

      {kind === 'booking' &&
        status === 'requested' &&
        (data.quote_questions || []).length > 0 && (
        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-slate-500">
            {data.awaiting_quote_details ? 'Questions sent' : 'Customer answers'}
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {data.quote_questions.map((q) => (
              <li key={q.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="font-medium">{q.question}</p>
                {q.answer ? (
                  <p className="mt-1 text-slate-600">{q.answer}</p>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">Waiting for customer answer</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {kind === 'booking' && status === 'quoted' && data.quote_amount != null && quoteFormMode !== 'quote' && (
        <section className="rounded-xl border border-violet-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Quote sent</h2>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {currency.format(Number(data.quote_amount))}
          </p>
          {data.quote_message && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{data.quote_message}</p>
          )}
          {(data.quote_questions || []).length > 0 && (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {data.quote_questions.map((q) => (
                <li key={q.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-medium">{q.question}</p>
                  {q.answer ? (
                    <p className="mt-1 text-slate-600">Answer: {q.answer}</p>
                  ) : null}
                </li>
              ))}
            </ul>
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
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <svg className="h-4 w-4 text-luminexa-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Add to calendar
        </button>
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
        peerName={data.customer_name}
        customerName={data.customer_name}
        emptyHint="Chat with the customer about this request."
        idleOpenLabel="Message customer"
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
            showToast('New time sent — waiting for the customer to accept.', 'success');
            setRescheduleOpen(false);
            load();
          }}
        />
      )}

      {kind === 'booking' && data && (
        <AddToCalendarModal
          open={calendarOpen}
          booking={{
            ...data,
            organization_name: data.organization_name || activeOrg?.organization_name,
          }}
          onClose={() => setCalendarOpen(false)}
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
