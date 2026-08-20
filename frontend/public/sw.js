/**
 * Luminexa production service worker.
 * - Precaches app shell + icons
 * - Cache-first for hashed /static/ assets only
 * - Network-first for navigations (SPA offline → index.html)
 * - Manifest always from network (so DevTools / install UI see updates)
 * - Never caches API / auth requests
 */
const CACHE_VERSION = 'lx-shell-v10';
const SHELL_URLS = [
  '/',
  '/index.html',
  '/icons/icon-96.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/screenshots/desktop-wide-v2.png',
  '/screenshots/mobile-narrow-v2.png',
];

function isApiRequest(url) {
  const path = url.pathname || '';
  return (
    path.startsWith('/api/') ||
    path.startsWith('/accounts/api/') ||
    path.startsWith('/admin/') ||
    path.startsWith('/media/')
  );
}

/** Hashed CRA bundles + icons/screenshots — safe to cache-first. */
function isImmutableStatic(url) {
  return url.origin === self.location.origin && (
    url.pathname.startsWith('/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/screenshots/') ||
    url.pathname === '/favicon.ico'
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(SHELL_URLS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  // Always fetch a fresh manifest so installability checks see current screenshots.
  if (url.pathname === '/manifest.json' || url.pathname === '/sw.js') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          cache.put('/index.html', fresh.clone());
          return fresh;
        } catch {
          const cached =
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (cached) return cached;
          return Response.error();
        }
      })()
    );
    return;
  }

  if (isImmutableStatic(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, fresh.clone());
        }
        return fresh;
      })()
    );
  }
});
