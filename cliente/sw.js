// Service worker: guarda la app para abrir rápido y sin señal. Los datos (API) nunca se guardan aquí.
const VERSION = 'lb-cliente-v2';
const SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  '../shared/lb.css', '../shared/config.js', '../shared/logic.js', '../shared/qa-backend.js', '../shared/api.js', '../shared/ui.js',
  '../shared/img/lb-emblema.png', '../shared/img/lb-wordmark.png'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API de Google y fuentes: directo a la red
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
});
