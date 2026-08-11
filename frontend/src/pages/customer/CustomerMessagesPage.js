import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChatThread from '../../components/chat/ChatThread';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import { emitNotificationsChanged } from '../../utils/customerNotifications';
import { emitMessagesChanged } from '../../utils/messageBadge';
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

export default function CustomerMessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const conversationParam = searchParams.get('conversation');

  const load = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listMyConversations()
      .then((res) => {
        setConversations(res.data?.results || []);
        emitMessagesChanged();
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (conversationParam) {
      const match = conversations.find(
        (c) => String(c.id) === String(conversationParam),
      );
      if (match) {
        setSelected((prev) => (prev && prev.id === match.id ? prev : match));
        return;
      }
      return;
    }
    setSelected(null);
  }, [conversations, conversationParam]);

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
    emitNotificationsChanged();
    return res;
  }, [selected]);

  const chatReturnTo = selected
    ? `/customer/messages?conversation=${selected.id}`
    : '/customer/messages';

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
            When you book a provider, your chat with them appears here — including booking details.
          </p>
        </div>
      ) : (
        <ul className="-mx-1 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-lx-soft ring-1 ring-slate-100">
          {conversations.map((item) => {
            const unread = Boolean(item.has_unread);
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
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white"
                    aria-hidden
                  >
                    {initials(item.organization_name || item.subject)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`truncate text-[15px] text-slate-900 ${
                          unread ? 'font-bold' : 'font-semibold'
                        }`}
                      >
                        {item.organization_name || item.subject}
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
          peerName={selected.organization_name || selected.subject}
          peerSubtitle="Provider"
          onClose={closeConversation}
          loadMessages={loadMessagesAndRefreshBadge}
          sendMessage={(body) => jobsAPI.sendConversationMessage(selected.id, body)}
          bookingDetailHref={(bookingId) => `/customer/bookings/${bookingId}`}
          returnTo={chatReturnTo}
        />
      )}
    </div>
  );
}
