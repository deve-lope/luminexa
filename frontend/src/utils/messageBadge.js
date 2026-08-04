export const MESSAGES_CHANGED_EVENT = 'luminexa:messages-changed';

/** Notify layouts to refresh the Messages tab/menu unread badge. */
export function emitMessagesChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
}
