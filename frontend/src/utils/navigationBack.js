/** Marketing/auth pages with no in-app header navigation. */

const NO_NAV_EXACT = new Set(['/', '/login']);

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return pathname || '/';
  return pathname.replace(/\/$/, '') || '/';
}

/**
 * Safe in-app return path from ?returnTo=.
 * Only same-origin relative paths under /customer or /provider.
 */
export function parseReturnTo(search = '') {
  const qs = (search || '').startsWith('?') ? search.slice(1) : search || '';
  if (!qs) return null;
  try {
    const raw = new URLSearchParams(qs).get('returnTo');
    if (!raw) return null;
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
    if (!(decoded.startsWith('/customer') || decoded.startsWith('/provider'))) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Append ?returnTo= (or &returnTo=) for detail/preview links. */
export function withReturnTo(href, returnTo) {
  if (!href || !returnTo) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}returnTo=${encodeURIComponent(returnTo)}`;
}

export function isMarketingOrLogin(pathname) {
  return NO_NAV_EXACT.has(normalizePath(pathname));
}

function catalogQuery(search = '') {
  const qs = (search || '').startsWith('?') ? search : search ? `?${search}` : '';
  if (!qs) return '';
  try {
    const cat = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs).get('cat');
    return cat ? `?cat=${encodeURIComponent(cat)}` : '';
  } catch {
    return '';
  }
}

/** Semantic parent when the in-app stack is empty (refresh / shared link). */
export function resolveCustomerBack(pathname, search = '') {
  const path = normalizePath(pathname);
  const returnTo = parseReturnTo(search);
  const catOnly = catalogQuery(search);

  if (path === '/customer') return null;
  if (returnTo) return { to: returnTo };

  if (path === '/customer/find') return { to: '/customer' };
  if (path === '/customer/categories') return { to: '/customer' };
  if (path.startsWith('/customer/find/')) {
    return { to: '/customer/categories' };
  }
  if (path === '/customer/account') return { to: '/customer' };
  if (/^\/customer\/bookings\/[^/]+$/.test(path)) {
    return { to: '/customer/bookings' };
  }
  if (path === '/customer/bookings') return { to: '/customer' };
  if (path === '/customer/messages') return { to: '/customer' };
  if (path === '/customer/notifications') return { to: '/customer' };
  if (path === '/customer/history') return { to: '/customer' };
  if (path === '/customer/about') return { to: '/customer' };
  if (/^\/customer\/provider\/[^/]+\/checkout$/.test(path)) {
    const key = path.split('/')[3];
    return { to: `/customer/provider/${key}` };
  }
  if (/^\/customer\/provider\/[^/]+\/services\/[^/]+$/.test(path)) {
    const key = path.split('/')[3];
    const serviceId = path.split('/')[5];
    return { to: `/customer/provider/${key}${catOnly}#service-${serviceId}` };
  }
  if (/^\/customer\/provider\/[^/]+\/[^/]+$/.test(path)) {
    const key = path.split('/')[3];
    return { to: `/customer/provider/${key}` };
  }
  if (/^\/customer\/provider\/[^/]+$/.test(path)) {
    return { to: '/customer' };
  }
  if (path === '/services') return { to: '/customer' };

  if (/^\/book\/[^/]+\/services\/[^/]+$/.test(path)) {
    const orgSlug = path.split('/')[2];
    const serviceId = path.split('/')[4];
    return { to: `/book/${orgSlug}${catOnly}#service-${serviceId}` };
  }
  if (/^\/book\/[^/]+\/services$/.test(path)) {
    return { to: path.replace(/\/services$/, '') };
  }
  if (/^\/book\/[^/]+\/[^/]+$/.test(path)) {
    const orgSlug = path.split('/')[2];
    return { to: `/book/${orgSlug}` };
  }
  if (/^\/book\/[^/]+$/.test(path)) {
    return { to: '/customer' };
  }

  if (path.startsWith('/customer')) return { to: '/customer' };
  return null;
}

export function resolveProviderBack(pathname, orgSlug, search = '') {
  if (!orgSlug) return null;
  const base = `/provider/${orgSlug}`;
  const path = normalizePath(pathname);
  const returnTo = parseReturnTo(search);

  if (path === base) return null;
  if (returnTo) return { to: returnTo };

  if (path === `${base}/schedule`) return { to: base };
  if (path === `${base}/requests`) return { to: base };
  if (path === `${base}/services`) return { to: base };
  if (path === `${base}/settings`) return { to: base };
  if (path === `${base}/account`) return { to: base };
  if (path === `${base}/billing`) return { to: `${base}/account` };
  if (path === `${base}/about`) return { to: base };
  if (path === `${base}/analytics`) return { to: base };
  if (path === `${base}/subscribe`) return { to: `${base}/account` };
  if (path === `${base}/clients`) return { to: base };

  if (path.startsWith(`${base}/schedule/`)) {
    return { to: `${base}/schedule` };
  }
  if (path.startsWith(`${base}/requests/`)) {
    return { to: `${base}/requests` };
  }
  if (path.startsWith(`${base}/clients/`)) {
    return { to: `${base}/clients` };
  }
  if (path === `${base}/messages`) return { to: base };
  if (path === `${base}/notifications`) return { to: base };
  if (path === `${base}/notifications/all`) return { to: `${base}/notifications` };
  if (path === `${base}/my-page` || path === `${base}/share`) return { to: base };
  if (path === `${base}/tasks`) return { to: base };
  if (path === `${base}/tasks/new`) return { to: `${base}/tasks` };

  if (path.startsWith(base)) return { to: base };
  return null;
}

/**
 * Provider viewing their own public /book URLs (service preview, catalog, storefront).
 */
export function resolveOwnerBookBack(pathname, orgSlug, search = '') {
  if (!orgSlug) return null;
  const path = normalizePath(pathname);
  const returnTo = parseReturnTo(search);
  if (returnTo) return { to: returnTo };

  const services = `/provider/${orgSlug}/services`;
  const myPage = `/provider/${orgSlug}/my-page`;
  const home = `/provider/${orgSlug}`;

  if (path === `/book/${orgSlug}/services` || path.startsWith(`/book/${orgSlug}/services/`)) {
    return { to: services };
  }
  if (path === `/book/${orgSlug}`) {
    return { to: myPage };
  }
  if (path.startsWith(`/book/${orgSlug}/`)) {
    return { to: `/book/${orgSlug}` };
  }
  return { to: home };
}

export function resolvePublicBack(pathname, search = '') {
  const path = normalizePath(pathname);
  const returnTo = parseReturnTo(search);
  if (returnTo) return { to: returnTo };
  if (NO_NAV_EXACT.has(path)) return null;
  if (path === '/services') return { to: '/' };
  if (/^\/book\/[^/]+\/services\/[^/]+$/.test(path)) {
    const slug = path.split('/')[2];
    return { to: `/book/${slug}/services` };
  }
  if (/^\/book\/[^/]+\/services$/.test(path)) {
    return { to: path.replace(/\/services$/, '') };
  }
  if (/^\/book\/[^/]+\/checkout$/.test(path)) {
    const slug = path.split('/')[2];
    return { to: `/book/${slug}` };
  }
  if (/^\/book\/[^/]+\/[^/]+$/.test(path)) {
    const slug = path.split('/')[2];
    return { to: `/book/${slug}` };
  }
  if (/^\/book\/[^/]+$/.test(path)) return { to: '/services' };
  if (path === '/register') return { to: '/' };
  if (path === '/register/business') return { to: '/' };
  if (path === '/forgot-password') return { to: '/login' };
  if (path === '/reset-password') return { to: '/login' };
  if (path === '/check-email') return { to: '/login' };
  if (path === '/verify-email') return { to: '/login' };
  if (path === '/accept-staff-invite') return { to: '/login' };
  return { to: '/' };
}
