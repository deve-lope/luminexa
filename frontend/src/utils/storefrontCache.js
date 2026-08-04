/** In-memory storefront payloads so Back doesn't flash a short "Loading…" page. */
const storefrontCache = new Map();

export function getStorefrontCache(slug) {
  if (!slug) return null;
  return storefrontCache.get(String(slug)) || null;
}

export function setStorefrontCache(slug, data) {
  if (!slug || !data) return;
  storefrontCache.set(String(slug), data);
}
