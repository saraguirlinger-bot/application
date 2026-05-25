/* ============================================
   HORIZON BUDGET — Service Worker v2.1
   URL : https://www.horizonpme.fr/application/
   ============================================ */

const CACHE_NAME = 'horizon-budget-v2';

const STATIC_FILES = [
  '/application/',
  '/application/index.html',
  '/application/manifest.json',
  '/application/css/app.css',
  '/application/js/db.js',
  '/application/js/router.js',
  '/application/js/app.js',
  '/application/js/licence.js',
  '/application/icons/icon-192.png',
  '/application/icons/icon-512.png'
];

// ==========================================
// INSTALLATION
// ==========================================
self.addEventListener('install', event => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Erreur install:', err))
  );
});

// ==========================================
// ACTIVATION — nettoyage anciens caches
// ==========================================
self.addEventListener('activate', event => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(n => n !== CACHE_NAME)
          .map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// ==========================================
// FETCH — Cache First, fallback réseau
// ==========================================
self.addEventListener('fetch', event => {
  const req = event.request;

  // Ignorer non-GET
  if (req.method !== 'GET') return;

  // Ignorer extensions Chrome
  if (req.url.startsWith('chrome-extension://')) return;

  // Ignorer Stripe et analytics
  if (req.url.includes('stripe.com') ||
      req.url.includes('google-analytics')) return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(response => {
        // Mettre en cache les ressources locales valides
        if (response.ok &&
            req.url.includes('horizonpme.fr/application')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return response;
      }).catch(() => {
        // Fallback hors ligne → retourner index.html
        if (req.mode === 'navigate') {
          return caches.match('/application/index.html');
        }
      });
    })
  );
});

// ==========================================
// MESSAGES
// ==========================================
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Horizon Budget v2.1 chargé');
