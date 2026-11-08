/** Format km for customer/provider “on the way” copy. */
export function formatDistanceKm(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1) return `${n.toFixed(1)} km`;
  if (n < 10) return `${n.toFixed(1)} km`;
  return `${Math.round(n)} km`;
}

export const EN_ROUTE_PING_MS = 5 * 60 * 1000;
