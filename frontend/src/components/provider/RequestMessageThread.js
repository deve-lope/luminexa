import React, { useCallback, useEffect, useRef, useState } from 'react';
import parseApiError from '../../utils/parseApiError';

function formatMessageTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function MessageBubble({ msg }) {
  return (
    <div className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          msg.is_mine
            ? 'bg-luminexa-accent text-white'
            : 'bg-white text-slate-900 ring-1 ring-slate-200'
        }`}
      >
        {!msg.is_mine && (
          <p className="mb-1 text-xs font-medium opacity-80">{msg.sender_name}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        <p className={`mt-1 text-[10px] ${msg.is_mine ? 'text-white/70' : 'text-slate-400'}`}>
          {formatMessageTime(msg.created_at)}
        </p>
      </div>
    </div>
  );
}

function ConversationSheet({
  open,
  onClose,
  customerName,
  messages,
  loading,
  error,
  body,
  setBody,
  sending,
  onSubmit,
  bottomRef,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/40 sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Conversation with ${customerName || 'customer'}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,640px)] min-h-[50vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:mx-auto sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="min-w-0 pr-3">
            <h2 className="font-semibold text-slate-900">Conversation</h2>
            {customerName && (
              <p className="truncate text-sm text-slate-600">{customerName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] shrink-0 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Done
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-3">
          {loading && <p className="text-sm text-slate-500">Loading messages…</p>}
          {!loading && !messages.length && (
            <p className="py-8 text-center text-sm text-slate-500">
              No messages yet. Say hello below.
            </p>
          )}
          {!loading &&
            messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && (
            <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <form onSubmit={onSubmit} className="flex gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder="Write a message…"
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="min-h-[44px] shrink-0 self-end rounded-xl bg-luminexa-accent px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RequestMessageThread({
  loadMessages,
  sendMessage,
  customerName,
  emptyHint,
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loadMessages();
      setMessages(Array.isArray(res.data) ? res.data : []);
      setLoaded(true);
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [loadMessages]);

  useEffect(() => {
    if (open && !loaded) {
      refresh();
    }
  }, [open, loaded, refresh]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages.length]);

  const submit = async (event) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(text);
      setBody('');
      await refresh();
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSending(false);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const previewText = lastMessage
    ? `${lastMessage.is_mine ? 'You' : lastMessage.sender_name}: ${lastMessage.body}`
    : null;

  const openLabel =
    messages.length > 0
      ? `Open conversation (${messages.length})`
      : 'Message customer';

  return (
    <>
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700"
            aria-hidden
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Messages</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {emptyHint || 'Chat with the customer about this request.'}
            </p>
            {loaded && previewText && (
              <p className="mt-2 line-clamp-2 text-sm text-slate-700">{previewText}</p>
            )}
            {loaded && !messages.length && (
              <p className="mt-2 text-sm text-slate-500">No messages yet.</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 min-h-[48px] w-full rounded-xl bg-luminexa-accent text-sm font-medium text-white"
        >
          {loaded ? openLabel : 'Open conversation'}
        </button>
      </section>

      <ConversationSheet
        open={open}
        onClose={() => setOpen(false)}
        customerName={customerName}
        messages={messages}
        loading={loading}
        error={error}
        body={body}
        setBody={setBody}
        sending={sending}
        onSubmit={submit}
        bottomRef={bottomRef}
      />
    </>
  );
}
