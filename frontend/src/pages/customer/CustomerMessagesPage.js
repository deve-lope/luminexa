import React, { useCallback, useEffect, useState } from 'react';
import RequestMessageThread from '../../components/provider/RequestMessageThread';
import { jobsAPI } from '../../utils/api';
import { formatWhen } from '../../utils/datetime';
import parseApiError from '../../utils/parseApiError';

function conversationKey(item) {
  return `${item.kind}-${item.id}`;
}

export default function CustomerMessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    jobsAPI
      .listMyConversations()
      .then((res) => setConversations(res.data?.results || []))
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && conversations.length === 0) {
    return <p className="py-12 text-center text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-4 pb-8">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <p className="text-sm text-slate-600">
        Messages with providers about your bookings and custom service requests.
      </p>

      {conversations.length === 0 ? (
        <div className="lx-empty">
          <p className="text-sm font-medium text-slate-800">No conversations yet</p>
          <p className="lx-muted mt-1">
            When you message a provider from a booking or request, it will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((item) => {
            const active = selected && conversationKey(selected) === conversationKey(item);
            return (
              <li key={conversationKey(item)}>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? 'border-teal-300 bg-teal-50/80 ring-1 ring-teal-200'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{item.subject}</p>
                      <p className="truncate text-sm text-slate-600">{item.organization_name}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-700">
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
                        <p className="mt-2 text-xs text-slate-500">
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
          peerName={selected.organization_name}
          onClose={() => {
            setSelected(null);
            load();
          }}
          loadMessages={() =>
            selected.kind === 'inquiry'
              ? jobsAPI.listInquiryMessages(
                  selected.organization_slug || selected.organization_public_ref,
                  selected.id,
                )
              : jobsAPI.listBookingMessages(selected.id)
          }
          sendMessage={(body) =>
            selected.kind === 'inquiry'
              ? jobsAPI.sendInquiryMessage(
                  selected.organization_slug || selected.organization_public_ref,
                  selected.id,
                  body,
                )
              : jobsAPI.sendBookingMessage(selected.id, body)
          }
        />
      )}
    </div>
  );
}
