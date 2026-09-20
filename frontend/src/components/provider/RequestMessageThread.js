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
  peerHref,
  customerName,
  emptyHint,
  idleOpenLabel = 'Message',
  compact = false,
  initiallyOpen = false,
  sheetOnly = false,
  onClose,
  bookingDetailHref,
  inquiryDetailHref,
  safety = null,
}) {
  const displayName = peerName || customerName || '';

  if (sheetOnly || initiallyOpen) {
    return (
      <ChatThread
        open
        onClose={onClose || (() => {})}
        peerName={displayName}
        peerHref={peerHref}
        loadMessages={loadMessages}
        sendMessage={sendMessage}
        bookingDetailHref={bookingDetailHref}
        inquiryDetailHref={inquiryDetailHref}
        safety={safety}
      />
    );
  }

  return (
    <ChatEntryCard
      loadMessages={loadMessages}
      sendMessage={sendMessage}
      peerName={displayName}
      peerHref={peerHref}
      emptyHint={emptyHint}
      idleOpenLabel={idleOpenLabel}
      compact={compact}
      bookingDetailHref={bookingDetailHref}
      inquiryDetailHref={inquiryDetailHref}
      safety={safety}
    />
  );
}
