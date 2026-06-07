export default function parseApiError(err) {
  const d = err?.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail);
  const first = d && Object.values(d)[0];
  return Array.isArray(first) ? first[0] : first || 'Request failed.';
}
