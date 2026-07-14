function isHtmlErrorBody(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
}

export default function parseApiError(err, fallback = 'Request failed.') {
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED') {
      return 'Request timed out. The server may be restarting — wait a moment and try again.';
    }
    const host = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000';
    return `Cannot reach the server at ${host}. Try http://127.0.0.1:3000 or https://app.luminex-a.com, then hard-refresh (Ctrl+Shift+R).`;
  }

  const status = err.response.status;
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is temporarily unavailable. Refresh the page and try again in a moment.';
  }
  if (status === 429) {
    return 'Too many attempts. Please wait a minute and try again.';
  }

  const d = err.response.data;
  if (typeof d === 'string') {
    if (isHtmlErrorBody(d)) {
      return 'The server is temporarily unavailable. Refresh the page and try again in a moment.';
    }
    return d;
  }
  if (d?.non_field_errors?.[0]) return d.non_field_errors[0];
  if (d?.detail) return typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail);
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || fallback;
}
