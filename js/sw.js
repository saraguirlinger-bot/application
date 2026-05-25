/* ============================================
   HORIZON BUDGET — Service Worker v3.2
   Cache mis à jour — purge v1/v2 automatique
   ============================================ */

const CACHE_NAME = 'horizon-budget-v3.2';

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
];

/* ── INSTALL ── */
self.addEventListener('install', (event) => {
  console.log('[SW v3.2] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE — purger TOUS les anciens caches ── */
self.addEventListener('activate', (event) => {
  console.log('[SW v3.2] Activate — purge anciens caches');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW v3.2] Suppression cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Notifier tous les onglets qu'une mise à jour est disponible
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: '3.2' }));
        });
      })
  );
});

/* ── FETCH — Network first pour HTML/JS/CSS ── */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes externes (Stripe, Google, etc.)
  if (url.origin !== self.location.origin) return;

  // Network first pour les fichiers principaux
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
        .catch(() => caches.match(event.request)
          .then(cached => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Cache first pour images/icônes
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});

/* ── MESSAGE ── */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
