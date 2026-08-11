import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChatThread from '../../components/chat/ChatThread';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import { emitMessagesChanged } from '../../utils/messageBadge';
import { emitProviderNotificationsChanged } from '../../utils/providerNotifications';
import {
  providerMessages,
  providerRequestDetail,
  providerScheduleDetail,
} from '../../utils/providerPaths';
import parseApiError from '../../utils/parseApiError';

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function ProviderMessagesPage() {
  const { orgSlug } = useProviderOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const resolvingLegacy = useRef(false);

  const conversationParam = searchParams.get('conversation');
  const bookingParam = searchParams.get('booking');
  const inquiryParam = searchParams.get('inquiry');

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

  // Keep open chat in sync with ?conversation=. Bare /messages (sidebar) closes the thread.
  useEffect(() => {
    if (conversationParam) {
      const match = conversations.find(
        (c) => String(c.id) === String(conversationParam),
      );
      if (match) {
        setSelected((prev) => (prev && prev.id === match.id ? prev : match));
        return;
      }
      // Conversations not loaded yet, or unknown id — wait.
      return;
    }

    if (bookingParam || inquiryParam) {
      if (resolvingLegacy.current || !orgSlug) return;
      resolvingLegacy.current = true;
      (async () => {
        try {
          let list = conversations;
          let match = null;
          if (bookingParam) {
            await jobsAPI.listBookingMessages(bookingParam);
            const refreshed = await jobsAPI.listProviderConversations(orgSlug);
            list = refreshed.data?.results || [];
            setConversations(list);
            const booking = await jobsAPI.getBooking(bookingParam);
            const customerId = booking.data?.customer || booking.data?.customer_id;
            match = list.find((c) => String(c.customer_id) === String(customerId)) || null;
          } else {
            await jobsAPI.listInquiryMessages(orgSlug, inquiryParam);
            const refreshed = await jobsAPI.listProviderConversations(orgSlug);
            list = refreshed.data?.results || [];
            setConversations(list);
            match = list[0] || null;
          }
          if (match) {
            setSelected(match);
            setSearchParams({ conversation: String(match.id) }, { replace: true });
          }
        } catch {
          /* ignore */
        } finally {
          resolvingLegacy.current = false;
        }
      })();
      return;
    }

    // Inbox URL with no conversation query → close chat.
    setSelected(null);
  }, [
    conversationParam,
    bookingParam,
    inquiryParam,
    conversations,
    orgSlug,
    setSearchParams,
  ]);

  const openConversation = (item) => {
    setSelected(item);
    setConversations((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, has_unread: false } : c)),
    );
    setSearchParams({ conversation: String(item.id) }, { replace: false });
  };

  const closeConversation = () => {
    setSelected(null);
    setSearchParams({}, { replace: true });
    load();
  };

  const loadMessagesAndRefreshBadge = useCallback(async () => {
    const res = await jobsAPI.listConversationMessages(selected.id);
    emitMessagesChanged();
    emitProviderNotificationsChanged();
    return res;
  }, [selected]);

  const chatReturnTo = selected
    ? `${providerMessages(orgSlug)}?conversation=${selected.id}`
    : providerMessages(orgSlug);

  if (loading && conversations.length === 0) {
    return <p className="py-12 text-center text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-3 pb-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {conversations.length === 0 ? (
        <div className="lx-empty">
          <p className="text-sm font-medium text-slate-800">No conversations yet</p>
          <p className="lx-muted mt-1">
            When customers book or message you, chats appear here with booking details in the
            thread.
          </p>
        </div>
      ) : (
        <ul className="-mx-1 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-lx-soft ring-1 ring-slate-100">
          {conversations.map((item) => {
            const unread = Boolean(item.has_unread);
            const name = item.customer_name || item.subject || 'Customer';
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openConversation(item)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    unread ? 'bg-teal-50/50' : ''
                  }`}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white"
                    aria-hidden
                  >
                    {initials(name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`truncate text-[15px] text-slate-900 ${
                          unread ? 'font-bold' : 'font-semibold'
                        }`}
                      >
                        {name}
                      </p>
                      {item.last_message_at ? (
                        <span
                          className={`shrink-0 text-[11px] ${
                            unread ? 'font-semibold text-teal-700' : 'text-slate-400'
                          }`}
                        >
                          {formatWhen(item.last_message_at)}
                        </span>
                      ) : null}
                    </div>
                    <p
                      className={`mt-0.5 line-clamp-1 text-sm ${
                        unread ? 'font-semibold text-slate-800' : 'text-slate-500'
                      }`}
                    >
                      {item.last_sender_name
                        ? `${item.last_sender_name}: ${item.last_message_preview}`
                        : item.last_message_preview}
                    </p>
                  </div>
                  {unread ? (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-600" aria-label="Unread" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <ChatThread
          key={selected.id}
          open
          peerName={selected.customer_name || selected.subject || 'Customer'}
          peerSubtitle="Customer"
          onClose={closeConversation}
          loadMessages={loadMessagesAndRefreshBadge}
          sendMessage={(body) => jobsAPI.sendConversationMessage(selected.id, body)}
          bookingDetailHref={(bookingId) =>
            providerScheduleDetail(orgSlug, 'booking', bookingId)
          }
          inquiryDetailHref={(inquiryId) =>
            providerRequestDetail(orgSlug, 'inquiry', inquiryId)
          }
          returnTo={chatReturnTo}
        />
      )}
    </div>
  );
}
