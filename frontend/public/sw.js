/**
 * Temporary self-healing service worker.
 * Clears poisoned caches from older builds, then unregisters itself.
 * (App registration is disabled on localhost / 127.0.0.1.)
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        if (client.url && 'navigate' in client) {
          client.navigate(client.url);
        }
      });
    })()
  );
});

// Do not intercept fetches — avoids Failed to fetch / HTML-as-JS errors.
