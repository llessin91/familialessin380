// Service Worker — Controle Financeiro
const CACHE_NAME = 'controle-financeiro-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] Falha ao cachear:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Não cacheia chamadas Firebase (precisa sempre estar fresco)
  if (req.url.includes('firestore.googleapis.com') || 
      req.url.includes('identitytoolkit.googleapis.com') ||
      req.url.includes('firebase')) {
    return;
  }
  
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        fetch(req).then((fresh) => {
          if (fresh && fresh.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(req, fresh));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req)
        .then((response) => {
          if (response && response.ok && (response.type === 'basic' || response.type === 'cors')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('./index.html');
        });
    })
  );
});
