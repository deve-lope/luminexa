/** Django admin URL — same-origin on prod/frontend ports; API host only for local CRA. */
export function getDjangoAdminUrl() {
  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    const onFrontendPort = port === '3000' || port === '80' || port === '443' || port === '';
    const onKnownHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('luminex-a.com');
    if (onFrontendPort && onKnownHost) {
      return '/admin/';
    }
  }
  const apiBase = (process.env.REACT_APP_API_URL || 'http://127.0.0.1:9001').replace(/\/$/, '');
  return `${apiBase}/admin/`;
}
