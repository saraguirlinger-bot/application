/* ============================================
   HORIZON BUDGET — Service Worker v3.3
   Cache unifié — purge automatique
   ============================================ */

const CACHE_NAME = 'horizon-budget-v3.3';

const STATIC_FILES = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/router.js',
  './js/licence.js',
  './js/fix.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client =>
            client.postMessage({ type: 'SW_UPDATED', version: '3.3' })
          );
        });
      })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (
    event.request.url.includes('.html') ||
    event.request.url.includes('.js')   ||
    event.request.url.includes('.css')  ||
    event.request.url.endsWith('/')     ||
    event.request.url.endsWith('/application') ||
    event.request.url.endsWith('/application/')
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => cached || caches.match('./index.html'))
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
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
