// Service Worker — Koala Pocket Sampler PWA
// Estrategia: cache-first para el shell de la app, con actualización en segundo plano.
// Todo el estado del sampler (samples, patrones, ajustes) vive en memoria del cliente;
// este SW solo garantiza que la app cargue sin conexión.

const CACHE_NAME = 'koala-sampler-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './sounds-manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Nunca interceptar CDNs externos (Tailwind, Font Awesome, Google Fonts) con
  // una estrategia agresiva: intentar red primero y caer a caché si falla.
  const isExternal = !req.url.startsWith(self.location.origin);

  if (isExternal) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Shell de la app: cache-first, con refresco en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
