/* ============================================
   HORIZON BUDGET — Service Worker
   Gestion du cache offline
   ============================================ */

const CACHE_NAME = 'horizon-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/db.js',
  '/js/router.js',
  '/js/app.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap'
];

/* ---- INSTALLATION : mise en cache des assets ---- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ---- ACTIVATION : nettoyage des anciens caches ---- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---- FETCH : cache en priorité, réseau en fallback ---- */
self.addEventListener('fetch', event => {
  // On ne met pas en cache les requêtes POST
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // On met en cache les nouvelles ressources valides
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline : retourner l'index pour la navigation
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

/* ---- MESSAGE : forcer la mise à jour ---- */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
