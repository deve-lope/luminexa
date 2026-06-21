/** Marketing/auth pages with no in-app header navigation. */

const NO_NAV_EXACT = new Set(['/', '/login']);

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return pathname || '/';
  return pathname.replace(/\/$/, '') || '/';
}

export function isMarketingOrLogin(pathname) {
  return NO_NAV_EXACT.has(normalizePath(pathname));
}

/** Fallback when history is empty — Back still uses navigate(-1) first. */
export function resolveCustomerBack(pathname) {
  const path = normalizePath(pathname);
  if (path === '/customer') return null;

  if (path === '/customer/find') return { to: '/customer' };
  if (path.startsWith('/customer/find/')) {
    return { to: '/customer/find' };
  }
  if (path === '/customer/account') return { to: '/customer' };
  if (path === '/customer/bookings') return { to: '/customer' };
  if (path === '/customer/history') return { to: '/customer' };
  if (/^\/customer\/provider\/[^/]+\/[^/]+$/.test(path)) {
    const key = path.split('/')[3];
    return { to: `/customer/provider/${key}` };
  }
  if (/^\/customer\/provider\/[^/]+\/services\/[^/]+$/.test(path)) {
    const key = path.split('/')[3];
    return { to: `/customer/provider/${key}` };
  }
  if (/^\/customer\/provider\/[^/]+$/.test(path)) {
    return { to: '/customer' };
  }
  if (path === '/services') return { to: '/customer' };

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

export function resolveProviderBack(pathname, orgSlug) {
  if (!orgSlug) return null;
  const base = `/provider/${orgSlug}`;
  const path = normalizePath(pathname);

  if (path === base) return null;

  if (path === `${base}/schedule`) return { to: base };
  if (path === `${base}/requests`) return { to: base };
  if (path === `${base}/services`) return { to: base };
  if (path === `${base}/settings`) return { to: base };
  if (path === `${base}/account`) return { to: base };

  if (path.startsWith(`${base}/schedule/`)) {
    return { to: `${base}/schedule` };
  }
  if (path.startsWith(`${base}/requests/`)) {
    return { to: `${base}/requests` };
  }
  if (path === `${base}/notifications`) return { to: base };
  if (path === `${base}/my-page` || path === `${base}/share`) return { to: base };
  if (path === `${base}/tasks`) return { to: base };
  if (path === `${base}/tasks/new`) return { to: `${base}/tasks` };

  if (path.startsWith(base)) return { to: base };
  return null;
}

export function resolvePublicBack(pathname) {
  const path = normalizePath(pathname);
  if (NO_NAV_EXACT.has(path)) return null;
  if (path === '/services') return { to: '/' };
  if (/^\/book\/[^/]+\/services$/.test(path)) {
    return { to: path.replace(/\/services$/, '') };
  }
  if (/^\/book\/[^/]+$/.test(path)) return { to: '/' };
  if (path === '/register') return { to: '/' };
  if (path === '/register/business') return { to: '/' };
  if (path === '/forgot-password') return { to: '/login' };
  if (path === '/reset-password') return { to: '/login' };
  if (path === '/accept-staff-invite') return { to: '/login' };
  return { to: '/' };
}
