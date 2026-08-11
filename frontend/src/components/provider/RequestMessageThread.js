/**
 * Backward-compatible wrapper around the WhatsApp-style ChatThread.
 * Prefer importing from `components/chat/ChatThread` for new code.
 */
import React from 'react';
import ChatThread, { ChatEntryCard } from '../chat/ChatThread';

export default function RequestMessageThread({
  loadMessages,
  sendMessage,
  peerName,
  customerName,
  emptyHint,
  idleOpenLabel = 'Message',
  compact = false,
  initiallyOpen = false,
  sheetOnly = false,
  onClose,
  bookingDetailHref,
  inquiryDetailHref,
}) {
  const displayName = peerName || customerName || '';

  if (sheetOnly || initiallyOpen) {
    return (
      <ChatThread
        open
        onClose={onClose || (() => {})}
        peerName={displayName}
        loadMessages={loadMessages}
        sendMessage={sendMessage}
        bookingDetailHref={bookingDetailHref}
        inquiryDetailHref={inquiryDetailHref}
      />
    );
  }

  return (
    <ChatEntryCard
      loadMessages={loadMessages}
      sendMessage={sendMessage}
      peerName={displayName}
      emptyHint={emptyHint}
      idleOpenLabel={idleOpenLabel}
      compact={compact}
      bookingDetailHref={bookingDetailHref}
      inquiryDetailHref={inquiryDetailHref}
    />
  );
}
