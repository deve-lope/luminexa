import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import RequestMessageThread from '../../components/provider/RequestMessageThread';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import { emitMessagesChanged } from '../../utils/messageBadge';
import { emitProviderNotificationsChanged } from '../../utils/providerNotifications';
import parseApiError from '../../utils/parseApiError';

function conversationKey(item) {
  return `${item.kind}-${item.id}`;
}

export default function ProviderMessagesPage() {
  const { orgSlug } = useProviderOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    jobsAPI
      .listProviderConversations(orgSlug)
      .then((res) => {
        setConversations(res.data?.results || []);
        emitMessagesChanged();
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  useEffect(() => {
    load();
  }, [load]);

  // Deep-link from message notifications: ?booking=ID or ?inquiry=ID
  useEffect(() => {
    if (!conversations.length || selected) return;
    const bookingId = searchParams.get('booking');
    const inquiryId = searchParams.get('inquiry');
    if (!bookingId && !inquiryId) return;

    const match = conversations.find((c) => {
      if (bookingId && c.kind === 'booking' && String(c.id) === String(bookingId)) return true;
      if (inquiryId && c.kind === 'inquiry' && String(c.id) === String(inquiryId)) return true;
      return false;
    });
    if (!match) return;

    setSelected(match);
    setConversations((prev) =>
      prev.map((c) =>
        conversationKey(c) === conversationKey(match) ? { ...c, has_unread: false } : c,
      ),
    );
    const next = new URLSearchParams(searchParams);
    next.delete('booking');
    next.delete('inquiry');
    setSearchParams(next, { replace: true });
  }, [conversations, searchParams, selected, setSearchParams]);

  const openConversation = (item) => {
    setSelected(item);
    setConversations((prev) =>
      prev.map((c) =>
        conversationKey(c) === conversationKey(item) ? { ...c, has_unread: false } : c,
      ),
    );
  };

  const loadMessagesAndRefreshBadge = async () => {
    const res =
      selected.kind === 'inquiry'
        ? await jobsAPI.listInquiryMessages(orgSlug, selected.id)
        : await jobsAPI.listBookingMessages(selected.id);
    emitMessagesChanged();
    // Backend dismisses related new_message alerts on mark-read; refresh the bell.
    emitProviderNotificationsChanged();
    return res;
  };

  if (loading && conversations.length === 0) {
    return <p className="py-12 text-center text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-4 pb-8">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <p className="text-sm text-slate-600">
        Conversations with customers about bookings and custom requests. Unread threads are shown in
        bold.
      </p>

      {conversations.length === 0 ? (
        <div className="lx-empty">
          <p className="text-sm font-medium text-slate-800">No conversations yet</p>
          <p className="lx-muted mt-1">
            When a customer messages you from a booking or request, it will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((item) => {
            const active = selected && conversationKey(selected) === conversationKey(item);
            const unread = Boolean(item.has_unread);
            return (
              <li key={conversationKey(item)}>
                <button
                  type="button"
                  onClick={() => openConversation(item)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? 'border-teal-300 bg-teal-50/80 ring-1 ring-teal-200'
                      : unread
                        ? 'border-teal-100 bg-teal-50/70 hover:border-teal-200'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`truncate text-slate-900 ${
                          unread ? 'font-bold' : 'font-semibold'
                        }`}
                      >
                        {item.subject}
                      </p>
                      <p
                        className={`truncate text-sm ${
                          unread ? 'font-semibold text-slate-800' : 'text-slate-600'
                        }`}
                      >
                        {item.customer_name || 'Customer'}
                      </p>
                      <p
                        className={`mt-1 line-clamp-2 text-sm ${
                          unread ? 'font-semibold text-slate-900' : 'text-slate-700'
                        }`}
                      >
                        {item.last_sender_name
                          ? `${item.last_sender_name}: ${item.last_message_preview}`
                          : item.last_message_preview}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        {item.kind === 'inquiry' ? 'Request' : 'Booking'}
                      </span>
                      {item.last_message_at && (
                        <p
                          className={`mt-2 text-xs ${
                            unread ? 'font-semibold text-slate-700' : 'text-slate-500'
                          }`}
                        >
                          {formatWhen(item.last_message_at)}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <RequestMessageThread
          key={conversationKey(selected)}
          sheetOnly
          initiallyOpen
          peerName={selected.customer_name || 'Customer'}
          onClose={() => {
            setSelected(null);
            load();
          }}
          loadMessages={loadMessagesAndRefreshBadge}
          sendMessage={(body) =>
            selected.kind === 'inquiry'
              ? jobsAPI.sendInquiryMessage(orgSlug, selected.id, body)
              : jobsAPI.sendBookingMessage(selected.id, body)
          }
        />
      )}
    </div>
  );
}
