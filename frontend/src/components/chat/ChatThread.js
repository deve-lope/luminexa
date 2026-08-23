import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import parseApiError from '../../utils/parseApiError';
import { formatWhen } from '../../utils/datetime';
import { withReturnTo } from '../../utils/navigationBack';

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'declined']);
const ACTIVE_BOOKING_STATUSES = new Set([
  'requested',
  'quoted',
  'confirmed',
  'in_progress',
  'needs_return',
]);

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function dayKey(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Today';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function timeLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function statusLabel(status) {
  if (!status) return '';
  const map = {
    completed: 'Done',
    cancelled: 'Cancelled',
    declined: 'Declined',
    requested: 'Requested',
    quoted: 'Quote sent',
    confirmed: 'Confirmed',
    in_progress: 'In progress',
    needs_return: 'Needs return',
    pending: 'Pending',
    active: 'Open',
  };
  return map[status] || String(status).replace(/_/g, ' ');
}

function parseThreadPayload(data) {
  if (Array.isArray(data)) {
    return { messages: data, activeBookings: [], activeInquiries: [] };
  }
  if (data && typeof data === 'object') {
    return {
      messages: Array.isArray(data.results) ? data.results : [],
      activeBookings: Array.isArray(data.active_bookings) ? data.active_bookings : [],
      activeInquiries: Array.isArray(data.active_inquiries) ? data.active_inquiries : [],
    };
  }
  return { messages: [], activeBookings: [], activeInquiries: [] };
}

function CompactHistoryTile({ card, detailHref }) {
  if (!card) return null;
  const when = card.start_at
    ? formatWhen(card.start_at)
    : card.preferred_date || null;
  const label = statusLabel(card.status);
  const line = [card.service_name || 'Booking', when, label].filter(Boolean).join(' · ');
  const inner = (
    <div className="flex max-w-[320px] items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-left shadow-sm ring-1 ring-black/5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-slate-800">{line}</p>
      </div>
      {detailHref ? (
        <span className="shrink-0 text-[11px] font-semibold text-teal-700">Details</span>
      ) : null}
    </div>
  );
  return (
    <div className="flex justify-center py-0.5">
      {detailHref ? (
        <Link to={detailHref} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

function BookingCardBubble({ card, detailHref, forceCompact = false }) {
  if (!card) return null;
  const isTerminal = forceCompact || TERMINAL_STATUSES.has(card.status);
  if (isTerminal) {
    return <CompactHistoryTile card={card} detailHref={detailHref} />;
  }

  const when = card.start_at ? formatWhen(card.start_at) : card.preferred_date || null;
  const isInquiry = card.type === 'inquiry_card' || Boolean(card.inquiry_id);
  const inner = (
    <div className="w-full max-w-[280px] overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5">
      <div className="bg-teal-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-teal-50">
        {isInquiry ? 'Service request' : 'Booking'}
        {card.reference ? ` · ${card.reference}` : ''}
      </div>
      <div className="space-y-1 px-3 py-3 text-left">
        <p className="text-sm font-semibold text-slate-900">{card.service_name || 'Details'}</p>
        {when ? <p className="text-xs text-slate-600">{when}</p> : null}
        {card.status ? (
          <p className="text-[11px] font-medium capitalize text-teal-800">
            {statusLabel(card.status)}
          </p>
        ) : null}
        {card.service_address ? (
          <p className="line-clamp-2 text-xs text-slate-500">{card.service_address}</p>
        ) : null}
        {card.summary ? (
          <p className="line-clamp-3 text-xs text-slate-600">{card.summary}</p>
        ) : null}
        {detailHref ? (
          <p className="pt-1 text-[11px] font-semibold text-teal-700">View details →</p>
        ) : null}
      </div>
    </div>
  );
  if (detailHref) {
    return (
      <div className="flex justify-center py-1">
        <Link to={detailHref} className="block">
          {inner}
        </Link>
      </div>
    );
  }
  return <div className="flex justify-center py-1">{inner}</div>;
}

function PinnedContextStrip({
  bookings,
  inquiries,
  bookingDetailHref,
  inquiryDetailHref,
  returnTo,
}) {
  if (!bookings.length && !inquiries.length) return null;

  return (
    <div className="shrink-0 border-b border-black/5 bg-teal-900/95 px-3 py-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-teal-100/70">
        Ongoing
      </p>
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {bookings.map((card) => {
          const base =
            bookingDetailHref && card.booking_id
              ? bookingDetailHref(card.booking_id)
              : null;
          const href = withReturnTo(base, returnTo);
          const when = card.start_at ? formatWhen(card.start_at) : null;
          const tile = (
            <div className="w-[200px] shrink-0 rounded-xl bg-white/95 px-3 py-2 text-left shadow-sm">
              <p className="truncate text-[13px] font-semibold text-slate-900">
                {card.service_name || 'Booking'}
              </p>
              {when ? <p className="mt-0.5 truncate text-[11px] text-slate-600">{when}</p> : null}
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                {statusLabel(card.status)}
              </p>
            </div>
          );
          return href ? (
            <Link key={`b-${card.booking_id}`} to={href} className="shrink-0">
              {tile}
            </Link>
          ) : (
            <div key={`b-${card.booking_id}`} className="shrink-0">
              {tile}
            </div>
          );
        })}
        {inquiries.map((card) => {
          const base =
            inquiryDetailHref && card.inquiry_id
              ? inquiryDetailHref(card.inquiry_id)
              : null;
          const href = withReturnTo(base, returnTo);
          const tile = (
            <div className="w-[200px] shrink-0 rounded-xl bg-amber-50 px-3 py-2 text-left shadow-sm ring-1 ring-amber-100">
              <p className="truncate text-[13px] font-semibold text-slate-900">
                {card.service_name || 'Request'}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-600">Custom request</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                {statusLabel(card.status)}
              </p>
            </div>
          );
          return href ? (
            <Link key={`i-${card.inquiry_id}`} to={href} className="shrink-0">
              {tile}
            </Link>
          ) : (
            <div key={`i-${card.inquiry_id}`} className="shrink-0">
              {tile}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TextBubble({ msg }) {
  const mine = Boolean(msg.is_mine);
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[78%] px-3 py-2 text-[15px] leading-snug shadow-sm ${
          mine
            ? 'rounded-2xl rounded-br-md bg-[#d1f4e0] text-slate-900'
            : 'rounded-2xl rounded-bl-md bg-white text-slate-900 ring-1 ring-black/5'
        }`}
      >
        {!mine && msg.sender_role !== 'system' && msg.sender_name ? (
          <p className="mb-0.5 text-[11px] font-semibold text-teal-800">{msg.sender_name}</p>
        ) : null}
        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        <p className={`mt-1 text-right text-[10px] ${mine ? 'text-teal-900/50' : 'text-slate-400'}`}>
          {timeLabel(msg.created_at)}
        </p>
      </div>
    </div>
  );
}

function SystemBubble({ msg }) {
  return (
    <div className="flex justify-center py-1">
      <p className="max-w-[90%] rounded-full bg-slate-200/80 px-3 py-1 text-center text-[11px] text-slate-600">
        {msg.body}
      </p>
    </div>
  );
}

function MessageRow({
  msg,
  bookingDetailHref,
  inquiryDetailHref,
  pinnedBookingIds,
  returnTo,
}) {
  if (msg.kind === 'booking_card') {
    const base =
      bookingDetailHref && msg.card?.booking_id
        ? bookingDetailHref(msg.card.booking_id)
        : null;
    const href = withReturnTo(base, returnTo);
    // Active bookings already show in the pin strip — keep timeline quiet.
    const isPinnedActive =
      msg.card?.booking_id &&
      pinnedBookingIds.has(msg.card.booking_id) &&
      ACTIVE_BOOKING_STATUSES.has(msg.card.status);
    if (isPinnedActive) {
      return <CompactHistoryTile card={msg.card} detailHref={href} />;
    }
    return <BookingCardBubble card={msg.card} detailHref={href} />;
  }
  if (msg.kind === 'inquiry_card') {
    const base =
      inquiryDetailHref && msg.card?.inquiry_id
        ? inquiryDetailHref(msg.card.inquiry_id)
        : null;
    const href = withReturnTo(base, returnTo);
    return <BookingCardBubble card={msg.card} detailHref={href} />;
  }
  if (msg.kind === 'system') {
    return <SystemBubble msg={msg} />;
  }
  return <TextBubble msg={msg} />;
}

/**
 * Full-screen chat thread (WhatsApp / iMessage style).
 */
export default function ChatThread({
  open,
  onClose,
  peerName,
  peerSubtitle,
  loadMessages,
  sendMessage,
  bookingDetailHref,
  inquiryDetailHref,
  /** Path to reopen this chat after visiting a booking/request detail (e.g. /provider/x/messages?conversation=1). */
  returnTo,
}) {
  const [messages, setMessages] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [activeInquiries, setActiveInquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const listRef = useRef(null);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await loadMessages();
        const parsed = parseThreadPayload(res.data);
        setMessages(parsed.messages);
        setActiveBookings(parsed.activeBookings);
        setActiveInquiries(parsed.activeInquiries);
      } catch (e) {
        if (!silent) setError(parseApiError(e));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [loadMessages],
  );

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!open) return undefined;
    refresh();
    const id = window.setInterval(() => refreshRef.current({ silent: true }), 4000);
    return () => window.clearInterval(id);
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = async (event) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(text);
      setBody('');
      await refresh({ silent: true });
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSending(false);
    }
  };

  const pinnedBookingIds = useMemo(
    () => new Set(activeBookings.map((b) => b.booking_id).filter(Boolean)),
    [activeBookings],
  );

  const rows = useMemo(() => {
    const out = [];
    let lastDay = null;
    for (const msg of messages) {
      const key = dayKey(msg.created_at);
      if (key && key !== lastDay) {
        out.push({ type: 'day', key: `day-${key}`, label: dayLabel(msg.created_at) });
        lastDay = key;
      }
      out.push({ type: 'msg', key: `m-${msg.id}`, msg });
    }
    return out;
  }, [messages]);

  if (!open) return null;

  // Portal to body so we are not trapped under AppShell’s sidebar stacking context.
  // On lg+, start after the w-60 sidebar so the composer is never covered.
  const sheet = (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#eae6df] lg:left-60"
      role="dialog"
      aria-modal="true"
      aria-label={`Chat with ${peerName || 'contact'}`}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-black/5 bg-teal-800 px-3 py-2.5 text-white shadow-sm">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-white/90 hover:bg-white/10"
          aria-label="Back to conversations"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white"
          aria-hidden
        >
          {initials(peerName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{peerName || 'Chat'}</p>
          {peerSubtitle ? (
            <p className="truncate text-xs text-teal-100/80">{peerSubtitle}</p>
          ) : null}
        </div>
      </header>

      <PinnedContextStrip
        bookings={activeBookings}
        inquiries={activeInquiries}
        bookingDetailHref={bookingDetailHref}
        inquiryDetailHref={inquiryDetailHref}
        returnTo={returnTo}
      />

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35) 0, transparent 45%), radial-gradient(circle at 80% 0%, rgba(15,118,110,0.06) 0, transparent 40%)',
        }}
      >
        {loading && !messages.length ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading messages…</p>
        ) : null}
        {!loading && !messages.length ? (
          <p className="py-10 text-center text-sm text-slate-500">
            No messages yet. Say hello below.
          </p>
        ) : null}
        {rows.map((row) =>
          row.type === 'day' ? (
            <div key={row.key} className="flex justify-center py-2">
              <span className="rounded-full bg-white/80 px-3 py-0.5 text-[11px] font-medium text-slate-600 shadow-sm">
                {row.label}
              </span>
            </div>
          ) : (
            <MessageRow
              key={row.key}
              msg={row.msg}
              bookingDetailHref={bookingDetailHref}
              inquiryDetailHref={inquiryDetailHref}
              pinnedBookingIds={pinnedBookingIds}
              returnTo={returnTo}
            />
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-black/5 bg-[#f0f2f5] px-3 py-2 pb-[max(0.5rem,var(--lx-sab))]">
        {error ? (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        <form onSubmit={submit} className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={1}
            placeholder="Message"
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-[22px] border-0 bg-white px-4 py-2.5 text-[15px] text-slate-900 shadow-sm ring-1 ring-black/5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white shadow-sm disabled:opacity-50"
            aria-label="Send"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}

/**
 * Compact entry card that opens ChatThread (booking/request detail pages).
 */
export function ChatEntryCard({
  loadMessages,
  sendMessage,
  peerName,
  emptyHint,
  idleOpenLabel = 'Message',
  compact = false,
  bookingDetailHref,
  inquiryDetailHref,
  returnTo,
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section
        className={
          compact
            ? 'mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3'
            : 'lx-card'
        }
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800"
            aria-hidden
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Messages</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {emptyHint || 'Chat with this contact about your bookings.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`mt-3 min-h-[44px] w-full rounded-xl text-sm font-medium text-white ${
            compact ? 'bg-teal-700' : 'mt-4 min-h-[48px] bg-luminexa-accent'
          }`}
        >
          {idleOpenLabel}
        </button>
      </section>
      <ChatThread
        open={open}
        onClose={() => setOpen(false)}
        peerName={peerName}
        loadMessages={loadMessages}
        sendMessage={sendMessage}
        bookingDetailHref={bookingDetailHref}
        inquiryDetailHref={inquiryDetailHref}
        returnTo={returnTo}
      />
    </>
  );
}
