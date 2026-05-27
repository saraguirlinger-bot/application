/* Horizon Budget — Service Worker v3.5 sécurisé */

const CACHE_NAME = 'horizon-budget-v3.5';
const APP_VERSION = '3.5.0';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  if (
    event.request.mode === 'navigate' ||
    event.request.url.includes('.html') ||
    event.request.url.includes('.js') ||
    event.request.url.includes('.css') ||
    event.request.url.includes('.json')
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone).catch(() => {});
          });
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => {
            return cached || caches.match('./index.html');
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(keys.map(key => caches.delete(key)))
      )
    );
  }

  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({
      type: 'SW_VERSION',
      version: APP_VERSION,
      cache: CACHE_NAME
    });
  }
});
