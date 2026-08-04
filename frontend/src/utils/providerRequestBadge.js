/** Persist which pending provider requests/inquiries staff have already viewed. */

function storageKey(orgSlug) {
  return `luminexa.seenProviderRequests.${orgSlug}`;
}

export function requestAlertKey(kind, id) {
  return `${kind}:${id}`;
}

export function loadSeenRequestKeys(orgSlug) {
  if (!orgSlug || typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(orgSlug));
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

/**
 * Mark pending items as seen when the provider opens the Requests tab.
 * Also drops stale ids that are no longer pending so storage stays small.
 */
export function markPendingRequestsSeen(orgSlug, pendingKeys) {
  if (!orgSlug || typeof window === 'undefined') return;
  const pending = [...new Set((pendingKeys || []).map(String).filter(Boolean))];
  window.localStorage.setItem(storageKey(orgSlug), JSON.stringify(pending));
}

export function countUnseenRequests(orgSlug, pendingKeys) {
  const seen = loadSeenRequestKeys(orgSlug);
  return (pendingKeys || []).filter((k) => !seen.has(String(k))).length;
}
