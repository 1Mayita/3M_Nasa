// Service worker mínimo: SOLO navegaciones, red primero.
// Si no hay red, muestra /offline.html (precacheado). No cachea ni sirve assets de la app.
const PREFIX = 'focos-nav-';
const CACHE = PREFIX + 'v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/404.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode !== 'navigate') return; // assets, API, datos: directo a la red
  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => cached || new Response(
        '<!doctype html><meta charset="utf-8"><title>Sin conexión</title><h1>Sin conexión</h1><p>Revisa tu internet.</p>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      ))
    )
  );
});
