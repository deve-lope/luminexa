const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:9001';

export function getDjangoAdminUrl() {
  return `${API_BASE_URL.replace(/\/$/, '')}/admin/`;
}
