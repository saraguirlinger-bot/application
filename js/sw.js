/* ============================================
   HORIZON BUDGET — Service Worker v3.2
   Cache busting automatique + mise à jour PWA
   ============================================ */

const CACHE_NAME    = 'horizon-budget-v3.2';
const CACHE_STATIC  = 'horizon-static-v3.2';

// Fichiers à mettre en cache au premier chargement
const STATIC_FILES = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/router.js',
  './js/licence.js',
  './manifest.json',
];

// ── INSTALL ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting()) // Prend le contrôle immédiatement
  );
});

// ── ACTIVATE — nettoyer les anciens caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== CACHE_STATIC)
          .map(key => {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim()) // Contrôler tous les onglets ouverts
  );
});

// ── FETCH — Network first pour HTML/JS/CSS, Cache first pour images ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes vers d'autres domaines (Stripe, Google...)
  if (url.origin !== self.location.origin) return;

  // Stratégie Network First pour les fichiers principaux
  if (
    event.request.url.includes('.html') ||
    event.request.url.includes('.js')   ||
    event.request.url.includes('.css')  ||
    event.request.url.endsWith('/')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Mettre en cache la nouvelle version
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline : servir depuis le cache
          return caches.match(event.request)
            .then(cached => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  // Cache First pour images et icônes
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});

// ── MESSAGE — forcer mise à jour depuis l'app ──
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
